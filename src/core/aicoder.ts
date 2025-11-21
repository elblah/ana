/**
 * Main AI Coder application class
 */

import { Config } from './config.js';
import { Stats } from './stats.js';
import { MessageHistory, Message } from './message-history.js';
import { StreamingClient, StreamChunk, ToolCall } from './streaming-client.js';
import { ToolManager } from './tool-manager.js';
import { ToolFormatter } from './tool-formatter.js';
import { InputHandler } from './input-handler.js';
import { CommandHandler } from './command-handler.js';
import { DetailMode } from './detail-mode.js';
import { pluginSystem } from './plugin-system.js';
import { ContextBar } from './context-bar.js';
import { PromptBuilder } from '../prompts/prompt-builder.js';
import { expandSnippets } from './snippet-utils.js';
import { Config } from './config.js';


export class AICoder {
  private stats: Stats;
  private messageHistory: MessageHistory;
  private streamingClient: StreamingClient;
  private toolManager: ToolManager;
  private inputHandler: InputHandler;
  private commandHandler: CommandHandler;
  private contextBar: ContextBar;
  private isRunning: boolean = true;
  private isProcessing: boolean = false;
  private approvalWasShown: boolean = false;
  private lastSigintTime: number = 0;
  private sigintWarningShown: boolean = false;
  private signalDebounceTimeout: any = null;

  constructor() {
    this.stats = new Stats();
    this.messageHistory = new MessageHistory(this.stats);
    this.toolManager = new ToolManager(this.stats);
    this.streamingClient = new StreamingClient(this.stats, this.toolManager);
    this.inputHandler = new InputHandler();
    this.inputHandler.setStatsContext(this.stats);
    this.inputHandler.setMessageHistory(this.messageHistory);
    this.messageHistory.setApiClient(this.streamingClient);
    this.commandHandler = new CommandHandler(this.messageHistory, this.inputHandler, this.stats);
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
  private async initializePlugins(): Promise<void> {
    try {
      // Connect plugin system context to actual command handler FIRST
      pluginSystem.setContext({
        config: Config,
        registerCommand: (name, handler, description) => {
          if (Config.debug) {
            console.log(`[DEBUG] Registering command: ${name}`);
          }
          this.commandHandler.registerCommand(name, handler, description);
        },
        addUserMessage: (message) => this.messageHistory.addUserMessage(message),
        addSystemMessage: (message) => this.messageHistory.addSystemMessage(message),
        getConfig: (key) => process.env[`AICODER_${key.toUpperCase()}`],
        setConfig: (key, value) => { process.env[`AICODER_${key.toUpperCase()}`] = String(value); },
        originalWriteFile: async (path, content) => this.toolManager.originalWriteFile(path, content),
        originalEditFile: async (path, oldStr, newStr) => this.toolManager.originalEditFile(path, oldStr, newStr),
        app: this
      });
      
      if (Config.debug) {
      console.log('[DEBUG] Plugin context connected, now loading plugins...');
    }
      
      await pluginSystem.loadPlugins();
      
      if (Config.debug) {
        console.log('[DEBUG] Plugins loaded, adding tools...');
      }

      // Add plugin tools to tool manager
      const pluginTools = pluginSystem.getAllTools();
      for (const [pluginName, tools] of pluginTools) {
        for (const tool of tools) {
          this.toolManager.addPluginTool(tool.name, tool.description, tool.parameters, tool.execute, pluginName);
        }
      }
    } catch (error) {
      console.log(`${Config.colors.yellow}[!] Plugin initialization failed: ${error}${Config.colors.reset}`);
    }
  }

  /**
   * Unified signal handler with debouncing
   */
  private handleSignal = (signalName: string): void => {
    // Clear any existing debounce timeout
    if (this.signalDebounceTimeout) {
      clearTimeout(this.signalDebounceTimeout);
    }

    // Debounce signal handling to prevent duplicates from readline, firejail, etc.
    this.signalDebounceTimeout = setTimeout(() => {
      const now = Date.now();
      const timeSinceLastSigint = now - this.lastSigintTime;

      // Guard clause: Second signal after 1 second - exit
      if (this.sigintWarningShown && timeSinceLastSigint >= 1000) {
        console.log(`\n${Config.colors.green}[*] Exiting gracefully${Config.colors.reset}`);
        process.exit(0);
      }

      // Guard clause: Signal pressed too quickly - show wait time
      if (this.sigintWarningShown && timeSinceLastSigint < 1000) {
        const remainingTime = Math.ceil((1000 - timeSinceLastSigint) / 100) / 10;
        if (this.isProcessing) {
          console.log(`\n${Config.colors.yellow}[!] Please wait ${remainingTime}s before pressing Ctrl+C again to exit${Config.colors.reset}`);
        }
        return;
      }

      // First signal - only show message if AI is processing
      if (this.isProcessing) {
        // During processing - interrupt gracefully
        console.log(`\n${Config.colors.yellow}[*] Process interrupted - please wait${Config.colors.reset}`);
        console.log(`${Config.colors.cyan}[*] Press Ctrl+C again (after 1 second) to exit or wait for prompt${Config.colors.reset}`);
        this.isProcessing = false;
      }
      // If not processing - don't show any message

      this.lastSigintTime = now;
      this.sigintWarningShown = true;
    }, 100); // 100ms debounce to catch all duplicate signals
  };

  /**
   * Setup interrupt handling
   */
  private setupInterruptHandling(): void {
    process.on('SIGINT', () => this.handleSignal('SIGINT'));
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
    if (!PromptBuilder.defaultPromptTemplate) {
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
      systemInfo: PromptBuilder.getSystemInfo()
    };

    // Build options
    const options = {
      overridePrompt: overridePrompt || undefined
    };

    return PromptBuilder.buildPrompt(context, options);
  }

  /**
   * Run the main application loop
   */
  async run(): Promise<void> {
    Config.validateConfig();
    
    // Initialize plugins before showing any output
    await this.initializePlugins();
    
    // Check if we're in non-interactive mode
    const isInteractive = process.stdin.isTTY;
    
    if (!isInteractive) {
      // Non-interactive mode: read from stdin, process once, exit
      await this.runNonInteractive();
      return;
    }
    
    // Interactive mode
    Config.printStartupInfo();
    console.log(`${Config.colors.green}Type your message or /help for commands.${Config.colors.reset}`);

    while (this.isRunning) {
      try {
        // Check for auto-compaction
        if (this.messageHistory.shouldAutoCompact()) {
          console.log(`${Config.colors.yellow}*** Auto-compaction triggered ***${Config.colors.reset}`);
          try {
            await this.messageHistory.compactMemory();
            console.log(`${Config.colors.green}*** Auto-compaction completed ***${Config.colors.reset}`);
          } catch (error) {
            console.log(`${Config.colors.yellow}*** Auto-compaction skipped: ${error} ***${Config.colors.reset}`);
          }
        }

        // Get user input (with notification hook)
        await this.callNotifyHook('onBeforeUserPrompt');
        const userInput = await this.inputHandler.getMultilineInput();

        // Don't reset interrupt warning state - Ctrl+C at prompt is swallowed
        // Only reset if we actually got input (not Ctrl+C)
        if (userInput && userInput !== '\x03') {
          this.sigintWarningShown = false;
          this.lastSigintTime = 0;
        }

        if (userInput === '\x03') {
          // User cancelled with Ctrl+C
          continue;
        }

        const trimmedInput = userInput.trim();
        if (!trimmedInput) {
          continue;
        }

        // Handle commands first
        if (trimmedInput.startsWith('/')) {
          const result = await this.commandHandler.handleCommand(trimmedInput);
          if (result.shouldQuit) {
            this.isRunning = false;
            break;
          }
          if (!result.runApiCall) {
            continue;
          }
          // If command returned a message, add it to history
          if (result.message) {
            this.messageHistory.addUserMessage(result.message);
            // Add to readline history for UP arrow navigation
            this.inputHandler.addToHistory(result.message);
          }
        } else {
          const processedInput = expandSnippets(trimmedInput);
          if (processedInput !== trimmedInput) {
            console.log(`${Config.colors.cyan}[Snippets expanded]${Config.colors.reset}`);
          }
          // Original to history/stats
          this.inputHandler.addToHistory(trimmedInput);
          this.stats.setLastUserPrompt(trimmedInput);
          // Expanded to AI
          this.messageHistory.addUserMessage(processedInput);
        }

        // Process with AI (with fallback for when API is down)
        await this.processWithAI();

      } catch (error) {
        console.error(`${Config.colors.red}Error: ${error}${Config.colors.reset}`);
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
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const userInput = Buffer.concat(chunks).toString('utf8').trim();
      
      if (!userInput) {
        // No input, exit silently
        return;
      }

      // Handle commands first
      if (userInput.startsWith('/')) {
        const result = await this.commandHandler.handleCommand(userInput);
        if (result.shouldQuit) {
          return;
        }
        if (!result.runApiCall) {
          // Command was handled, no API call needed
          this.stats.printStats();
          return;
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
      console.error(`${Config.colors.red}Error: ${error}${Config.colors.reset}`);
      this.inputHandler.close();
      process.exit(1);
    }
  }

  /**
   * Process conversation with AI
   */
  private async processWithAI(): Promise<void> {
    this.isProcessing = true;
    
    try {
      const messages = this.messageHistory.getMessages();

      if (Config.debug) {
        console.log(`${Config.colors.yellow}*** Sending ${messages.length} messages to API${Config.colors.reset}`);
      }

// Show context bar before AI response
console.log();
this.contextBar.printContextBar(this.stats, this.messageHistory);

console.log(`${Config.colors.bold}${Config.colors.green}AI:${Config.colors.reset} `);

      let fullResponse = '';
      const accumulatedToolCalls: Map<number, ToolCall> = new Map();

      // Check if user interrupted before starting stream
      if (!this.isProcessing) {
        console.log('\n[AI response interrupted before starting]');
        return;
      }

      // Reset colorizer for new response
      this.streamingClient.resetColorizer();

      // Stream response
      for await (const chunk of this.streamingClient.streamRequest(messages)) {
        // Check if user interrupted
        if (!this.isProcessing) {
          console.log('\n[AI response interrupted]');
          break;
        }
        
        // Handle usage info
        if (chunk.usage) {
          this.streamingClient.updateTokenStats(chunk.usage);
        }

        // Handle content
        if (chunk.choices && chunk.choices[0]) {
          const choice = chunk.choices[0];

          if (choice.delta?.content) {
            const content = choice.delta.content;
            fullResponse += content;
            // Process with markdown colorization
            const coloredContent = this.streamingClient.processWithColorization(content);
            // Write directly to stdout without any newline
            process.stdout.write(coloredContent);
          }

          // Handle tool calls (accumulate them)
          if (choice.delta?.tool_calls) {
            for (const toolCall of choice.delta.tool_calls) {
              const index = toolCall.index;

              if (!accumulatedToolCalls.has(index)) {
                // Validate tool call has required fields
                if (!toolCall.function?.name) {
                  console.error(`${Config.colors.red}Invalid tool call: missing function name${Config.colors.reset}`);
                  continue;
                }

                accumulatedToolCalls.set(index, {
                  id: toolCall.id || `tool_call_${index}_${Date.now()}`,
                  type: toolCall.type || 'function',
                  function: {
                    name: toolCall.function.name,
                    arguments: toolCall.function?.arguments || '',
                  },
                });
              } else {
                // Safely accumulate arguments only (names should come complete)
                const existing = accumulatedToolCalls.get(index)!;
                if (toolCall.function?.arguments) {
                  existing.function.arguments += toolCall.function.arguments;
                }
              }
            }
          }

          if (choice.finish_reason === 'tool_calls') {
            process.stdout.write('\n');
          }
        }
      }

      // After streaming completes, process tool calls
      if (accumulatedToolCalls.size > 0) {
        const toolCalls = Array.from(accumulatedToolCalls.values());

        // Debug: Show what we accumulated (only if debug mode)
        if (Config.debug) {
          console.log(`${Config.colors.yellow}Tool calls accumulated: ${toolCalls.length}${Config.colors.reset}`);
          for (const tc of toolCalls) {
            const argsPreview = tc.function.arguments.substring(0, 100);
            console.log(`${Config.colors.yellow}- ${tc.function.name}: ${argsPreview}${tc.function.arguments.length > 100 ? '...' : ''}${Config.colors.reset}`);
          }
        }

        // Validate tool calls before execution
        const validToolCalls = toolCalls.filter(toolCall => {
          if (!toolCall.function?.name || !toolCall.id) {
            console.error(`${Config.colors.red}Invalid tool call: missing name or id${Config.colors.reset}`);
            return false;
          }
          return true;
        });

        if (validToolCalls.length === 0) {
          console.error(`${Config.colors.red}No valid tool calls to execute${Config.colors.reset}`);
        } else {
          // Add assistant message with complete tool calls
          this.messageHistory.addAssistantMessage({
            content: fullResponse || "I'll help you with that.",
            tool_calls: validToolCalls
          });

          // Execute tools (with previews already shown)
          await this.executeToolCalls(validToolCalls);

          // Continue conversation after tool execution (only if not interrupted)
          if (this.isProcessing) {
            try {
              await this.processWithAI();
            } catch (error) {
              console.error(`${Config.colors.red}AI Error: ${error}${Config.colors.reset}`);
            }
          }
        }
      } else {
        // Handle empty response - this should not happen but we need to handle it gracefully
        if (fullResponse) {
          // Add regular assistant response
          this.messageHistory.addAssistantMessage({
            content: fullResponse
          });
          console.log(''); // Add newline after response
        } else {
          // Empty response - add a placeholder to maintain conversation flow
          this.messageHistory.addAssistantMessage({
            content: "[No response received]"
          });
          console.log(`${Config.colors.yellow}[No response received - continuing...]${Config.colors.reset}`);
        }
      }

    } catch (error) {
      this.messageHistory.addAssistantMessage({
        content: `[AI Error: ${error instanceof Error ? error.message : String(error)}]`
      });
      console.error(`${Config.colors.red}AI Error: ${error}${Config.colors.reset}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute tool calls (internal tools only)
   */
  private async executeToolCalls(toolCalls: ToolCall[]): Promise<void> {

    for (const toolCall of toolCalls) {
      const { name } = toolCall.function;
      const toolDef = this.toolManager.getToolDefinition(name);

      // Show tool header with cleaner format
      console.log(`${Config.colors.yellow}[*] Tool: ${name}${Config.colors.reset}`);

      // Always show command info, regardless of YOLO mode
      // Show preview for file operations, formatted args for others
      let preview = null;
      if (toolDef.generatePreview) {
        const args = JSON.parse(toolCall.function.arguments);
        preview = await this.toolManager.generatePreview(name, args);
        if (preview) {
          console.log(ToolFormatter.formatPreview(preview));
        }
        
        // Show file path
        if (args.path) {
          console.log(`Path: ${args.path}`);
        }
      } else {
        // Fallback to formatted arguments for non-file tools
        const formattedArgs = this.toolManager.formatToolArguments(name, toolCall.function.arguments);
        console.log(formattedArgs);
      }

      // Guard clause: Auto-reject if preview indicates operation cannot be approved
      if (preview && !preview.canApprove) {
        // Add tool result with the detailed error from preview content
        this.messageHistory.addToolResults([{
          tool_call_id: toolCall.id,
          content: preview.content
        }]);
        continue;
      }

      // Track if we should interrupt after tool execution (for guidance)
      let shouldInterruptAfterExecution = false;

      // Only ask for approval if not in YOLO mode and tool requires approval
      if (!Config.yoloMode && toolDef && !toolDef.auto_approved) {
        // Call notification hook before showing approval prompt
        await this.callNotifyHook('onBeforeApprovalPrompt');

        const approval = await this.inputHandler.prompt(
          `${Config.colors.yellow}Approve [Y/n]: ${Config.colors.reset}`
        );

        // Empty input defaults to 'y'
        const approvalAnswer = approval.trim().toLowerCase() || 'y';
        
        // Handle special yolo command
        if (approvalAnswer === 'yolo') {
          Config.setYoloMode(true);
          console.log(`${Config.colors.green}[*] YOLO mode ENABLED${Config.colors.reset}`);
        }
        
        // Parse guidance and aliases
        const hasGuidance = approvalAnswer.endsWith('+');
        const baseAnswer = hasGuidance ? approvalAnswer.slice(0, -1) : approvalAnswer;
        
        // Map aliases to canonical form
        const canonicalAnswer = 
          baseAnswer === 'a' ? 'y' : // 'a' for allow
          baseAnswer === 'd' ? 'n' : // 'd' for deny  
          baseAnswer;
        
        // Set guidance interruption flag
        shouldInterruptAfterExecution = hasGuidance;
        
        // Guard clause: Handle denial
        if (canonicalAnswer !== 'y' && canonicalAnswer !== 'yes' && approvalAnswer !== 'yolo') {
          console.log(`${Config.colors.red}[x] Tool execution cancelled.${Config.colors.reset}`);
          
          this.messageHistory.addToolResults([{
            tool_call_id: toolCall.id,
            content: `ERROR: User denied execution of tool '${name}'. The tool was not run.`
          }]);
          
          // Guard clause: Handle guidance interruption
          if (shouldInterruptAfterExecution) {
            this.isProcessing = false;
          }
          continue;
        }
      }

      const result = await this.toolManager.executeToolCall(toolCall, true); // skip preview (already shown above)
      this.messageHistory.addToolResults([result]);

      if (toolDef?.hide_results) {
        console.log(`${Config.colors.green}[*] Done${Config.colors.reset}`);
      } else {
        // Display based on detail mode - no parsing needed
        if (!DetailMode.enabled && result.friendly) {
          console.log(result.friendly);
        } else {
          console.log(result.content);
        }
      }
      
      // Handle guidance interruption after tool execution
      if (shouldInterruptAfterExecution) {
        this.isProcessing = false;
      }
    }
  }
  

  /**
   * Call notification hooks if they exist
   */
  private async callNotifyHook(hookName: 'onBeforeUserPrompt' | 'onBeforeApprovalPrompt'): Promise<void> {
    try {
      // Check if notify plugin has registered hooks
      const hooks = (this as any)._notifyPromptHooks;
      if (hooks && typeof hooks[hookName] === 'function') {
        await hooks[hookName]();
      }
    } catch (error) {
      // Silently fail - notifications aren't critical
    }
  }
}
