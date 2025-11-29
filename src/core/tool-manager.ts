/**
 * Tool manager for AI Coder - Internal tools only
 */

import type { Stats } from './stats.js';
import { Config } from './config.js';
import { FileUtils } from '../utils/file-utils.js';
import { LogUtils } from '../utils/log-utils.js';
import { ToolFormatter, type ToolOutput as ToolFormatterOutput, type ToolPreview } from './tool-formatter.js';
import {
    type ToolExecutionArgs,
    type ApiRequestData,
    type ToolParameters,
} from './types/index.js';

export interface ToolCall {
    id: string;
    type: string;
    function: {
        name: string;
        arguments: string;
    };
}
import {
    TOOL_DEFINITION as READ_FILE_DEF,
    type ReadFileParams,
} from '../tools/internal/read-file.js';
import {
    TOOL_DEFINITION as WRITE_FILE_DEF,
    type WriteFileParams,
} from '../tools/internal/write-file.js';
import { TOOL_DEFINITION as EDIT_FILE_DEF } from '../tools/internal/edit-file.js';
import {
    TOOL_DEFINITION as RUN_SHELL_COMMAND_DEF,
    type RunShellCommandParams,
} from '../tools/internal/run-shell-command.js';
import {
    TOOL_DEFINITION as GREP_DEF,
    type GrepParams,
} from '../tools/internal/grep.js';
import {
    TOOL_DEFINITION as LIST_DIRECTORY_DEF,
    type ListDirectoryParams,
} from '../tools/internal/list-directory.js';
import { pluginSystem } from './plugin-system.js';

export interface ToolDefinition {
    type: 'internal' | 'plugin';
    auto_approved: boolean;
    approval_excludes_arguments: boolean;
    approval_key_exclude_arguments: string[];
    hide_results: boolean;
    description: string;
    parameters: ToolParameters;
    pluginName?: string;
    execute?: (args: ToolExecutionArgs) => Promise<ToolFormatterOutput>;
    formatArguments?: (args: ToolExecutionArgs) => string | undefined;
    generatePreview?: (args: ToolExecutionArgs) => Promise<ToolPreview | null> | undefined;
    validateArguments?: (args: ToolExecutionArgs) => void | Promise<void>;
}

export interface ToolResult {
    tool_call_id: string;
    content: string;
    friendly?: string;
}

export class ToolManager {
    private stats: Stats;
    private tools: Map<string, ToolDefinition> = new Map();
    private currentDir: string;
    private readFiles: Set<string> = new Set(); // Track which files have been read

    constructor(stats: Stats) {
        this.stats = stats;
        this.currentDir = process.cwd();
        this.registerInternalTools();
    }

    /**
     * Register internal tools only
     */
    private registerInternalTools(): void {
        this.tools.set('read_file', READ_FILE_DEF);
        this.tools.set('write_file', WRITE_FILE_DEF);
        this.tools.set('edit_file', EDIT_FILE_DEF);
        this.tools.set('run_shell_command', RUN_SHELL_COMMAND_DEF);
        this.tools.set('grep', GREP_DEF);
        this.tools.set('list_directory', LIST_DIRECTORY_DEF);

        LogUtils.debug(`*** Registered ${this.tools.size} internal tools`, Config.colors.green);
    }

    /**
     * Add a plugin tool
     */
    addPluginTool(
        name: string,
        description: string,
        parameters: ToolParameters,
        execute: (args: ToolExecutionArgs) => Promise<ToolFormatterOutput>,
        pluginName: string,
        auto_approved: boolean = false
    ): void {
        this.tools.set(name, {
            type: 'plugin',
            auto_approved,
            approval_excludes_arguments: false,
            approval_key_exclude_arguments: [],
            hide_results: false,
            description,
            parameters,
            pluginName,
            execute,
        });

        LogUtils.debug(
            `*** Registered plugin tool: ${name} from ${pluginName}`,
            Config.colors.green
        );
    }

    /**
     * Get tool definitions for API (internal tools only)
     */
    getToolDefinitions(): ApiRequestData['tools'] {
        const definitions: ApiRequestData['tools'] = [];

        for (const [name, toolDef] of this.tools) {
            // Include both internal and plugin tools
            definitions.push({
                type: 'function',
                function: {
                    name,
                    description: toolDef.description,
                    parameters: toolDef.parameters,
                },
            });
        }

        return definitions;
    }

    /**
     * Execute a tool call (internal tools only)
     */
    async executeToolCall(toolCall: ToolCall, skipPreview = false): Promise<ToolResult> {
        const { id, function: func } = toolCall;
        const { name, arguments: args } = func;

        try {
            const toolDef = this.validateTool(name);
            const argsObj = this.parseArguments(args);

            // Handle plugin hooks
            const cancelResult = await this.handlePluginHooks(name!, argsObj, id);
            if (cancelResult) {
                return cancelResult;
            }

            // Validate required arguments for each tool
            await this.validateToolArguments(name!, argsObj);

            // Execute the appropriate tool
            const toolOutput = await this.executeTool(name!, argsObj, toolDef);

            return this.formatResult(toolOutput, toolDef, name!, id);
        } catch (error) {
            return {
                tool_call_id: id,
                content: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    /**
     * Check if a tool needs approval
     */
    needsApproval(toolName: string): boolean {
        const toolDef = this.tools.get(toolName);
        return toolDef ? !toolDef.auto_approved : true;
    }

    /**
     * Get tool definition
     */
    getToolDefinition(toolName: string): ToolDefinition | undefined {
        return this.tools.get(toolName);
    }

    /**
     * Get all registered tool names (internal tools only)
     */
    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * Validate tool arguments - each tool handles its own validation internally
     */
    private async validateToolArguments(toolName: string, args: ToolExecutionArgs): Promise<void> {
        const toolDef = this.tools.get(toolName);
        if (toolDef?.validateArguments) {
            await toolDef.validateArguments(args);
        }
    }

    /**
     * Check if path is safe (simple sandbox)
     */
    private checkSandbox(toolName: string, path: string): boolean {
        if (Config.sandboxDisabled) {
            LogUtils.print('[!] Sandbox-fs disabled - allowing all paths', {
                color: Config.colors.cyan,
            });
            return true;
        }

        if (!path) return true;

        // Block parent directory traversal
        if (path.includes('../')) {
            LogUtils.warn(
                `[x] Sandbox-fs: ${toolName} trying to access "${path}" outside current directory`
            );
            return false;
        }

        // For absolute paths, check if they're within current directory
        if (path.startsWith('/')) {
            if (!path.startsWith(this.currentDir)) {
                LogUtils.warn(
                    `[x] Sandbox-fs: ${toolName} trying to access "${path}" outside current directory`
                );
                return false;
            }
        }

        return true;
    }

    /**
     * Check if file was read in this session
     */
    private wasFileRead(path: string): boolean {
        return this.readFiles.has(path);
    }

    /**
     * Check if file exists (simple check)
     */
    private fileExists(path: string): boolean {
        try {
            require('fs').statSync(path);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Format tool arguments for display using custom formatter or JSON fallback
     */
    formatToolArguments(toolName: string, args: ToolExecutionArgs | string): string {
        const toolDef = this.tools.get(toolName);
        if (toolDef?.formatArguments) {
            try {
                // Use custom formatter
                if (typeof args === 'string') {
                    // Parse JSON if it's a string (from the API)
                    args = JSON.parse(args) as ToolExecutionArgs;
                }
                return (toolDef.formatArguments(args) as string) || 'Unable to format arguments';
            } catch (error) {
                // Fallback to JSON if formatter fails
                if (Config.debug) {
                    LogUtils.warn(
                        `[!] Custom formatter failed for ${toolName}, falling back to JSON`
                    );
                }
            }
        }

        // Default JSON formatting with truncation for large content
        if (typeof args === 'string') {
            // Try to parse as JSON first
            try {
                const parsed = JSON.parse(args);
                return JSON.stringify(parsed, null, 2);
            } catch {
                // Return as-is if not valid JSON
                return args;
            }
        }

        return JSON.stringify(args, null, 2);
    }

    /**
     * Generate preview for a tool call (if supported)
     */
    async generatePreview(toolName: string, args: ToolExecutionArgs): Promise<ToolPreview | null> {
        const toolDef = this.tools.get(toolName);
        if (!toolDef?.generatePreview) {
            return null;
        }

        try {
            const preview = await toolDef.generatePreview(args);
            return preview || null;
        } catch (error) {
            LogUtils.error(`[!] Preview generation failed for ${toolName}: ${error}`);
            return null;
        }
    }

    /**
     * Get internal tool names specifically
     */
    getInternalToolNames(): string[] {
        return Array.from(this.tools.entries())
            .filter(([_, toolDef]) => toolDef.type === 'internal')
            .map(([name, _]) => name);
    }

    /**
     * Parse and validate tool arguments
     */
    private parseArguments(args: string | ToolExecutionArgs | undefined): ToolExecutionArgs {
        if (!args) {
            return {};
        }

        if (typeof args === 'string') {
            if (args.trim() === '') {
                return {};
            }
            try {
                return JSON.parse(args) as ToolExecutionArgs;
            } catch (error) {
                LogUtils.error(`JSON Parse Error - Raw arguments: ${JSON.stringify(args)}`);
                const argsStr = args;
                throw new Error(
                    `Invalid JSON in tool arguments: ${error}. Raw arguments: ${argsStr?.substring(0, 200) || 'undefined'}${argsStr && argsStr.length > 200 ? '...' : ''}`
                );
            }
        }

        if (typeof args === 'object') {
            return args as ToolExecutionArgs;
        }

        throw new Error(`Invalid arguments type: ${typeof args}`);
    }

    /**
     * Validate tool exists and is supported
     */
    private validateTool(name: string): ToolDefinition {
        if (!name || !this.tools.has(name)) {
            throw new Error(`Unknown tool: ${name}`);
        }

        const toolDef = this.tools.get(name)!;
        if (toolDef.type !== 'internal' && toolDef.type !== 'plugin') {
            throw new Error(`External tool ${name} is not supported in this configuration`);
        }

        return toolDef;
    }

    /**
     * Handle plugin hooks and return cancellation result if needed
     */
    private async handlePluginHooks(name: string, argsObj: ToolExecutionArgs, toolCallId: string): Promise<ToolResult | null> {
        // Call plugin beforeTool hook
        const hookResult = pluginSystem.beforeToolCall(name, argsObj);
        if (hookResult === false) {
            // Plugin wants to cancel the tool call
            return {
                tool_call_id: toolCallId,
                content: `Tool call ${name} cancelled by plugin`,
            };
        }
        return null;
    }

    /**
     * Execute tool and handle tracking
     */
    private async executeTool(name: string, argsObj: ToolExecutionArgs, toolDef: ToolDefinition): Promise<ToolFormatterOutput> {
        try {
            if (!toolDef.execute) {
                throw new Error(`Tool ${name} has no execute method`);
            }

            const toolOutput = await toolDef.execute(argsObj);

            // Track that we read this file (special case for read_file)
            if (name === 'read_file' && argsObj.path && typeof argsObj.path === 'string') {
                this.readFiles.add(argsObj.path);
            }

            return toolOutput;
        } catch (execError) {
            throw new Error(
                `Tool execution failed for ${name}: ${execError instanceof Error ? execError.message : String(execError)}`
            );
        }
    }

    /**
     * Format result for AI and display, handling plugin hooks
     */
    private formatResult(toolOutput: ToolFormatterOutput, toolDef: ToolDefinition, toolName: string, toolCallId: string): ToolResult {
        // Call plugin afterTool hook
        const modifiedOutput = pluginSystem.afterToolCall(toolName, toolOutput);
        if (modifiedOutput !== undefined) {
            const modifiedAiResult = ToolFormatter.formatForAI(
                modifiedOutput as unknown as ToolOutput
            );
            const modifiedFriendlyResult = ToolFormatter.formatForDisplay(
                modifiedOutput as unknown as ToolOutput
            );
            return {
                tool_call_id: toolCallId,
                content: modifiedAiResult,
                friendly: modifiedFriendlyResult || undefined,
            };
        }

        // Format for AI and display
        let aiResult = ToolFormatter.formatForAI(toolOutput);
        const friendlyResult = ToolFormatter.formatForDisplay(toolOutput);

        // Check if result is too large
        aiResult = this.checkSize(aiResult, toolDef, toolName);

        return {
            tool_call_id: toolCallId,
            content: aiResult,
            friendly: friendlyResult || undefined,
        };
    }

    /**
     * Check if result is too large and truncate if needed
     */
    private checkSize(aiResult: string, toolDef: ToolDefinition, toolName: string): string {
        const resultSize = Buffer.byteLength(aiResult, 'utf8');
        if (resultSize <= Config.maxToolResultSize) {
            return aiResult;
        }

        if (toolDef.description.includes('file')) {
            return `ERROR: File content too large (${resultSize} bytes). Maximum ${Config.maxToolResultSize} bytes allowed. Use alternative approach to read specific portions of the file.`;
        }
        
        if (toolDef.description.includes('command')) {
            return `ERROR: Command output too large (${resultSize} bytes). Maximum ${Config.maxToolResultSize} bytes allowed. Use command options to limit output size.`;
        }
        
        if (toolDef.description.includes('directory')) {
            return `ERROR: Directory listing too large (${resultSize} bytes). Maximum ${Config.maxToolResultSize} bytes allowed. Navigate to a more specific subdirectory or filter results.`;
        }

        return `ERROR: Tool result too large (${resultSize} bytes). Maximum ${Config.maxToolResultSize} bytes allowed.`;
    }

    /**
     * Original write file method (for plugin compatibility)
     */
    async originalWriteFile(path: string, content: string): Promise<string> {
        return await FileUtils.writeFile(path, content);
    }

    /**
     * Original edit file method (for plugin compatibility)
     */
    async originalEditFile(path: string, oldString: string, newString: string): Promise<string> {
        return await FileUtils.editFile(path, oldString, newString);
    }
}
