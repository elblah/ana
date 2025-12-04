/**
 * Main AI Coder application class
 */

import { Config } from './config.js';
import { Stats } from './stats.js';
import { LogUtils } from '../utils/log-utils.js';
import { MessageHistory } from './message-history.js';
import { StreamingClient } from './streaming-client.js';
import type { 
    Message, 
    MessageToolCall, 
    StreamChunkData,
    StreamChunk,
    ToolCall,
    ToolExecutionArgs,
    NotificationHooks, 
    HookName 
} from './types/index.js';
import { ToolManager } from './tool-manager.js';
import { ToolFormatter, type ToolOutput } from './tool-formatter.js';
import { InputHandler } from './input-handler.js';
import { CommandHandler } from './command-handler.js';
import { pluginSystem } from './plugin-system.js';
import { ContextBar } from './context-bar.js';
import { StreamUtils } from '../utils/stream-utils.js';
import { PromptBuilder } from '../prompts/prompt-builder.js';
import { expandSnippets } from './snippet-utils.js';

export class AICoder {
    private stats: Stats;
    private messageHistory: MessageHistory;
    private streamingClient: StreamingClient;
    private toolManager: ToolManager;
    private inputHandler: InputHandler;
    private commandHandler: CommandHandler;
    private contextBar: ContextBar;
    private isRunning = true;
    private isProcessing = false;
    private approvalWasShown = false;
    
    private notifyHooks: NotificationHooks | null = null;

    constructor() {
        this.stats = new Stats();
        this.messageHistory = new MessageHistory(this.stats);
        this.toolManager = new ToolManager(this.stats);
        this.streamingClient = new StreamingClient(this.stats, this.toolManager);
        this.inputHandler = new InputHandler();
        this.inputHandler.setStatsContext(this.stats);
        this.inputHandler.setMessageHistory(this.messageHistory);
        this.messageHistory.setApiClient(this.streamingClient);
        this.commandHandler = new CommandHandler(
            this.messageHistory,
            this.inputHandler,
            this.stats
        );
        this.contextBar = new ContextBar();

        // Setup signal handling for interrupt
        this.setupInterruptHandling();
    }

    /**
     * Async initialization method
     */
    async initialize(): Promise<void> {
        await this.initializeSystemPrompt();
    }

    /**
     * Initialize plugin system
     */
    private initializePlugins(): void {
        if (Config.disablePlugins) {
            LogUtils.warn('[*] Plugins disabled via DISABLE_PLUGINS environment variable');
            return;
        }

        try {
            this.setupPluginContext();
            pluginSystem.loadPlugins();
            this.addPluginTools();
        } catch (error) {
            LogUtils.warn(`[!] Plugin initialization failed: ${error}`);
        }
    }

    private setupPluginContext(): void {
        pluginSystem.setContext({
            config: Config,
            registerCommand: (name, handler, description) => {
                this.commandHandler.registerCommand(name, handler, description);
            },
            addUserMessage: (message) => this.messageHistory.addUserMessage(message),
            addSystemMessage: (message) => this.messageHistory.addSystemMessage(message),
            getConfig: (key) => process.env[`AICODER_${key.toUpperCase()}`],
            setConfig: (key, value) => {
                process.env[`AICODER_${key.toUpperCase()}`] = String(value);
            },
            originalWriteFile: async (path, content) =>
                this.toolManager.originalWriteFile(path, content),
            originalEditFile: async (path, oldStr, newStr) =>
                this.toolManager.originalEditFile(path, oldStr, newStr),
            app: this as Record<string, unknown>,
            registerNotifyHooks: (hooks: NotificationHooks) => this.registerNotifyHooks(hooks),
        });
    }

    private addPluginTools(): void {
        const pluginTools = pluginSystem.getAllTools();
        for (const [toolName, tool] of pluginTools) {
            this.toolManager.addPluginTool(
                tool.name,
                tool.description,
                tool.parameters,
                tool.execute as unknown as (args: ToolExecutionArgs) => Promise<ToolOutput>,
                'plugin',
                tool.auto_approved || false
            );
        }
    }

    /**
     * Simple signal handler
     */
    private handleSignal = (): void => {
        // First signal - interrupt processing if active
        if (this.isProcessing) {
            LogUtils.warn(`\n[*] Process interrupted - please wait`);
            LogUtils.print(
                `[*] Press Ctrl+C again to exit or wait for prompt`,
                { color: Config.colors.cyan }
            );
            this.isProcessing = false;
            return;
        }
        
        // Second signal - exit gracefully
        LogUtils.success('\n[*] Exiting gracefully');
        process.exit(0);
    };

    /**
     * Setup interrupt handling
     */
    private setupInterruptHandling(): void {
        process.on('SIGINT', () => this.handleSignal());
    }

    /**
     * Initialize with system prompt focused on internal tools
     */
    private async initializeSystemPrompt(): Promise<void> {
        const systemPrompt = await this.buildSystemPrompt();
        this.messageHistory.addSystemMessage(systemPrompt);
    }

    /**
     * Build system prompt using universal prompt builder
     */
    private async buildSystemPrompt(): Promise<string> {
        // Initialize prompt builder if needed
        if (!PromptBuilder.isInitialized) {
            await PromptBuilder.initialize();
        }

        // Load external files
        const overridePrompt = await PromptBuilder.loadPromptOverride();
        const agentsContent = await PromptBuilder.loadAgentsContent();

        // Build context
        const context = {
            agentsContent: agentsContent || '',
            currentDirectory: process.cwd(),
            currentDatetime: new Date().toISOString(),
            systemInfo: PromptBuilder.getSystemInfo(),
        };

        // Build options
        const options = {
            overridePrompt: overridePrompt || undefined,
        };

        return PromptBuilder.buildPrompt(context, options);
    }

    /**
     * Perform auto-compaction with consistent logging
     */
    private async performAutoCompaction(context = 'during processing'): Promise<void> {
        LogUtils.warn(`*** Auto-compaction triggered ${context} ***`);
        try {
            await this.messageHistory.compactMemory();
            LogUtils.success('*** Auto-compaction completed ***');
        } catch (error) {
            LogUtils.warn(`*** Auto-compaction skipped: ${error} ***`);
        }
    }

    /**
     * Add user input with snippet expansion
     */
    private async addUserInput(input: string): Promise<void> {
        const processed = expandSnippets(input);
        if (processed !== input) {
            LogUtils.print('[Snippets expanded]', { color: Config.colors.cyan });
        }
        this.inputHandler.addToHistory(input);
        this.stats.setLastUserPrompt(input);
        this.messageHistory.addUserMessage(processed);
    }

    /**
     * Accumulate tool call from stream
     */
    private accumulateToolCall(toolCall: MessageToolCall, accumulated: Map<number, ToolCall>): void {
        const index = toolCall.index;

        if (accumulated.has(index)) {
            const existing = accumulated.get(index)!;
            if (toolCall.function?.arguments) {
                existing.function.arguments += toolCall.function.arguments;
            }
            return;
        }

        if (!toolCall.function?.name) {
            LogUtils.error('Invalid tool call: missing function name');
            return;
        }

        accumulated.set(index, {
            id: toolCall.id || `tool_call_${index}_${Date.now()}`,
            type: toolCall.type || 'function',
            function: {
                name: toolCall.function.name,
                arguments: toolCall.function?.arguments || '',
            },
        });
    }



    private validateToolCalls(toolCalls: ToolCall[]): ToolCall[] {
        return toolCalls.filter((toolCall) => {
            if (!toolCall.function?.name || !toolCall.id) {
                LogUtils.error('Invalid tool call: missing name or id');
                return false;
            }
            return true;
        });
    }

    private handleEmptyResponse(fullResponse: string): void {
        if (fullResponse && fullResponse.trim() !== '') {
            // AI provided text response but no tools
            this.messageHistory.addAssistantMessage({ content: fullResponse });
            console.log('');
        } else {
            // AI provided no text response (this is normal when AI has nothing to say)
            // Add a minimal message to show AI responded, then continue
            this.messageHistory.addAssistantMessage({ content: '' });
            console.log('');
        }
    }

    /**
     * Run the main application loop
     */
    async run(): Promise<void> {
        Config.validateConfig();

        // Initialize plugins before showing any output
        this.initializePlugins();

        // Check if we're in non-interactive mode
        const isInteractive = process.stdin.isTTY;

        if (!isInteractive) {
            // Non-interactive mode: read from stdin, process once, exit
            await this.runNonInteractive();
            return;
        }

        // Interactive mode
        Config.printStartupInfo();
        LogUtils.success('Type your message or /help for commands.');

        while (this.isRunning) {
            try {
                // Auto-compaction check
                if (this.messageHistory.shouldAutoCompact()) {
                    await this.performAutoCompaction();
                }

                // Get user input (with notification hook)
                await this.callNotifyHook('onBeforeUserPrompt');
                const userInput = await this.inputHandler.getUserInput();

                

                const trimmedInput = userInput.trim();
                if (!trimmedInput) {
                    continue;
                }

                // Handle commands
                if (trimmedInput.startsWith('/')) {
                    const result = await this.commandHandler.handleCommand(trimmedInput);
                    if (result.shouldQuit) {
                        this.isRunning = false;
                        break;
                    }
                    if (!result.runApiCall) {
                        continue;
                    }
                    if (result.message) {
                        await this.addUserInput(result.message);
                    }
                } else {
                    await this.addUserInput(trimmedInput);
                }

                // Process with AI (with fallback for when API is down)
                await this.processWithAI();
            } catch (error) {
                LogUtils.error(`Error: ${error}`);
            }
        }

        // Print final stats
        this.stats.printStats();

        // Close persistent readline to allow clean exit
        this.inputHandler.close();
    }

    /**
     * Run in non-interactive mode (piped input or redirected stdin)
     */
    private async runNonInteractive(): Promise<void> {
        try {
            // Read all input from stdin
            const userInput = await StreamUtils.readStdinAsString();

            if (!userInput) {
                // No input, exit silently
                return;
            }

            // Handle commands
            if (userInput.startsWith('/')) {
                const result = await this.commandHandler.handleCommand(userInput);
                if (result.shouldQuit) {
                    return;
                }
                if (!result.runApiCall) {
                    this.stats.printStats();
                    return;
                }
                if (result.message) {
                    await this.addUserInput(result.message);
                }
            } else {
                const processedInput = expandSnippets(userInput);
                this.messageHistory.addUserMessage(processedInput);
            }

            // Process with AI
            await this.processWithAI();

            // Print final stats
            this.stats.printStats();

            // Close persistent readline to allow clean exit
            this.inputHandler.close();
        } catch (error) {
            LogUtils.error(`Error: ${error}`);
            this.inputHandler.close();
            process.exit(1);
        }
    }

    /**
     * Prepare for AI processing - compaction, setup, and interruption check
     */
    private async prepareForProcessing(): Promise<{ shouldContinue: boolean; messages: any[] }> {
        // Auto-compaction before AI request
        if (this.messageHistory.shouldAutoCompact()) {
            await this.performAutoCompaction();
        }

        const messages = this.messageHistory.getMessages();

        // Show context bar before AI response
        console.log();
        this.contextBar.printContextBar(this.stats, this.messageHistory);

        LogUtils.print('AI: ', { color: Config.colors.green, bold: true });

        // Check if user interrupted before starting stream
        if (!this.isProcessing) {
            console.log('\n[AI response interrupted before starting]');
            return { shouldContinue: false, messages };
        }

        return { shouldContinue: true, messages };
    }

    /**
     * Validate and process accumulated tool calls
     */
    private async validateAndProcessToolCalls(fullResponse: string, accumulatedToolCalls: Map<number, ToolCall>): Promise<boolean> {
        if (accumulatedToolCalls.size === 0) {
            this.handleEmptyResponse(fullResponse);
            return false;
        }

        const toolCalls = Array.from(accumulatedToolCalls.values());

        const validToolCalls = this.validateToolCalls(toolCalls);
        if (validToolCalls.length === 0) {
            LogUtils.error('No valid tool calls to execute');
            return false;
        }

        this.messageHistory.addAssistantMessage({
            content: fullResponse || "I'll help you with that.",
            tool_calls: validToolCalls.map((call, index) => ({
                ...call,
                index,
            })) as MessageToolCall[],
        });

        await this.executeToolCalls(validToolCalls);
        return true;
    }

    /**
     * Stream AI response and handle chunks
     */
    private async streamResponse(
        messages: any[]
    ): Promise<{ shouldContinue: boolean; fullResponse: string; accumulatedToolCalls: Map<number, ToolCall> }> {
        const fullResponseWrapper = { value: '' };
        const accumulatedToolCalls: Map<number, ToolCall> = new Map();

        for await (const chunk of this.streamingClient.streamRequest(messages)) {
            // Check if user interrupted
            if (!this.isProcessing) {
                console.log('\n[AI response interrupted]');
                return { shouldContinue: false, fullResponse: fullResponseWrapper.value, accumulatedToolCalls };
            }

            // Handle chunk
            this.handleStreamChunk(chunk, fullResponseWrapper, accumulatedToolCalls);
        }

        return { shouldContinue: true, fullResponse: fullResponseWrapper.value, accumulatedToolCalls };
    }

    /**
     * Handle individual stream chunk
     */
    private handleStreamChunk(
        chunk: any, 
        fullResponse: { value: string }, 
        accumulatedToolCalls: Map<number, ToolCall>
    ): void {
        if (chunk.usage) {
            this.streamingClient.updateTokenStats(chunk.usage);
        }

        const choice = chunk.choices?.[0];
        if (!choice) return;

        // Content
        if (choice.delta?.content) {
            fullResponse.value += choice.delta.content;
            const coloredContent = this.streamingClient.processWithColorization(
                choice.delta.content
            );
            process.stdout.write(coloredContent);
        }

        // Tool calls
        if (choice.delta?.tool_calls) {
            for (const toolCall of choice.delta.tool_calls) {
                this.accumulateToolCall(toolCall, accumulatedToolCalls);
            }
        }

        if (choice.finish_reason === 'tool_calls') {
            process.stdout.write('\n');
        }
    }

    /**
     * Handle processing errors
     */
    private handleProcessingError(error: unknown): void {
        this.messageHistory.addAssistantMessage({
            content: `[AI Error: ${error instanceof Error ? error.message : String(error)}]`,
        });
        LogUtils.error(`AI Error: ${error}`);
    }

    /**
     * Handle post-processing after tool calls
     */
    private async handlePostProcessing(hasToolCalls: boolean): Promise<void> {
        if (hasToolCalls && this.isProcessing && this.messageHistory.shouldAutoCompact()) {
            await this.performAutoCompaction('after tool execution');
        }

        if (hasToolCalls && this.isProcessing) {
            try {
                await this.processWithAI();
            } catch (error) {
                LogUtils.error(`AI Error: ${error}`);
            }
        }
    }

    /**
     * Process conversation with AI
     */
    private async processWithAI(): Promise<void> {
        this.isProcessing = true;

        try {
            const preparation = await this.prepareForProcessing();
            if (!preparation.shouldContinue) {
                return;
            }

            this.streamingClient.resetColorizer();

            const streamingResult = await this.streamResponse(preparation.messages);
            if (!streamingResult.shouldContinue) {
                return;
            }

            const hasToolCalls = await this.validateAndProcessToolCalls(
                streamingResult.fullResponse, 
                streamingResult.accumulatedToolCalls
            );

            await this.handlePostProcessing(hasToolCalls);
        } catch (error) {
            this.handleProcessingError(error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Execute tool calls (internal tools only)
     */
    private async executeToolCalls(toolCalls: ToolCall[]): Promise<void> {
        for (const toolCall of toolCalls) {
            await this.executeSingleToolCall(toolCall);
        }
    }

    /**
     * Execute a single tool call
     */
    private async executeSingleToolCall(toolCall: ToolCall): Promise<void> {
        const { name } = toolCall.function;
        const toolDef = this.toolManager.getToolDefinition(name);

        LogUtils.print(`[*] Tool: ${name}`, { color: Config.colors.yellow });

        // Tool not found
        if (!toolDef) {
            this.handleToolNotFound(name, toolCall.id);
            return;
        }

        const preview = await this.generateToolPreview(toolCall);
        this.displayToolInfo(toolCall, toolDef, preview);

        // Auto-reject if preview cannot be approved
        if (preview && !preview.canApprove) {
            this.addToolResult(toolCall.id, preview.content);
            return;
        }

        const shouldInterruptAfterExecution = await this.handleToolApproval(toolCall, toolDef);
        if (shouldInterruptAfterExecution === null) {
            return; // User denied execution
        }

        await this.executeApprovedTool(toolCall, toolDef, shouldInterruptAfterExecution);
    }

    /**
     * Handle tool not found case
     */
    private handleToolNotFound(name: string, toolCallId: string): void {
        LogUtils.print(`[x] Tool not found: ${name}`, { color: Config.colors.red });
        this.messageHistory.addSystemMessage(`Error: Tool '${name}' does not exist.`);
    }

    /**
     * Generate preview for a tool call
     */
    private async generateToolPreview(toolCall: ToolCall): Promise<any> {
        const toolDef = this.toolManager.getToolDefinition(toolCall.function.name);
        if (!toolDef?.generatePreview) {
            return null;
        }

        const args = JSON.parse(toolCall.function.arguments);
        return await this.toolManager.generatePreview(toolCall.function.name, args);
    }

    /**
     * Display tool information
     */
    private displayToolInfo(toolCall: ToolCall, toolDef: any, preview: any): void {
        if (preview) {
            LogUtils.print(ToolFormatter.formatPreview(preview));
            const args = JSON.parse(toolCall.function.arguments);
            if (args.path) {
                LogUtils.print(`Path: ${args.path}`);
            }
        } else {
            const formattedArgs = this.toolManager.formatToolArguments(
                toolCall.function.name,
                toolCall.function.arguments
            );
            LogUtils.print(formattedArgs);
        }
    }

    /**
     * Handle tool approval logic
     */
    private async handleToolApproval(toolCall: ToolCall, toolDef: any): Promise<boolean | null> {
        // Auto-approve if in yolo mode or tool is auto-approved
        if (Config.yoloMode || toolDef?.auto_approved) {
            return false;
        }

        await this.callNotifyHook('onBeforeApprovalPrompt');

        const approval = await this.inputHandler.prompt(
            `${Config.colors.yellow}Approve [Y/n]: ${Config.colors.reset}`
        );

        const approvalAnswer = approval.trim().toLowerCase() || 'y';

        // Handle yolo command
        if (approvalAnswer === 'yolo') {
            Config.setYoloMode(true);
            LogUtils.success('[*] YOLO mode ENABLED');
            return false;
        }

        // Parse approval
        const hasGuidance = approvalAnswer.endsWith('+');
        const baseAnswer = hasGuidance ? approvalAnswer.slice(0, -1) : approvalAnswer;

        const canonicalAnswer =
            baseAnswer === 'a' ? 'y' : baseAnswer === 'd' ? 'n' : baseAnswer;

        // User denied
        if (canonicalAnswer !== 'y' && canonicalAnswer !== 'yes') {
            LogUtils.error('[x] Tool execution cancelled.');
            this.addToolResult(toolCall.id, `ERROR: User denied execution of tool '${toolCall.function.name}'. The tool was not run.`);
            
            if (hasGuidance) {
                this.isProcessing = false;
            }
            return null;
        }

        return hasGuidance;
    }

    /**
     * Execute an approved tool call
     */
    private async executeApprovedTool(toolCall: ToolCall, toolDef: any, shouldInterruptAfterExecution: boolean): Promise<void> {
        const result = await this.toolManager.executeToolCall(toolCall, true); // skip preview (already shown above)
        this.addToolResult(toolCall.id, result.content);

        this.displayToolResult(result, toolDef);

        // Handle guidance interruption after tool execution
        if (shouldInterruptAfterExecution) {
            this.isProcessing = false;
        }
    }

    /**
     * Add tool result to message history
     */
    private addToolResult(toolCallId: string, content: string): void {
        this.messageHistory.addToolResults([{
            tool_call_id: toolCallId,
            content,
        }]);
    }

    /**
     * Display tool execution result
     */
    private displayToolResult(result: any, toolDef: any): void {
        if (toolDef?.hide_results) {
            LogUtils.success('[*] Done');
        } else {
            // Display based on detail mode - no parsing needed
            if (!Config.detailMode && result.friendly) {
                LogUtils.print(result.friendly);
            } else {
                LogUtils.print(result.content);
            }
        }
    }

    /**
     * Register notification hooks (for plugins)
     */
    registerNotifyHooks(hooks: NotificationHooks): void {
        this.notifyHooks = hooks;
    }

    /**
     * Call notification hooks if they exist
     */
    private async callNotifyHook(hookName: HookName): Promise<void> {
        try {
            // Check if notify plugin has registered hooks
            const hooks = this.notifyHooks;
            if (hooks && typeof hooks[hookName] === 'function') {
                await hooks[hookName]();
            }
        } catch (error) {
            // Silently fail - notifications aren't critical
        }
    }
}
