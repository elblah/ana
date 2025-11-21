/**
 * Tool manager for AI Coder - Internal tools only
 */

import { Stats } from './stats.js';
import { Config } from './config.js';
import { ToolFormatter, ToolOutput, ToolPreview } from './tool-formatter.js';
import { executeReadFile, TOOL_DEFINITION as READ_FILE_DEF } from '../tools/internal/read-file.js';
import { executeWriteFile, TOOL_DEFINITION as WRITE_FILE_DEF } from '../tools/internal/write-file.js';
import { executeEditFile, TOOL_DEFINITION as EDIT_FILE_DEF, validate_edit_file } from '../tools/internal/edit-file.js';
import { executeRunShellCommand, TOOL_DEFINITION as RUN_SHELL_COMMAND_DEF } from '../tools/internal/run-shell-command.js';
import { executeGrep, TOOL_DEFINITION as GREP_DEF } from '../tools/internal/grep.js';
import { executeListDirectory, TOOL_DEFINITION as LIST_DIRECTORY_DEF } from '../tools/internal/list-directory.js';
import { pluginSystem } from './plugin-system.js';

export interface ToolDefinition {
  type: string;
  auto_approved: boolean;
  approval_excludes_arguments: boolean;
  approval_key_exclude_arguments: string[];
  hide_results: boolean;
  description: string;
  parameters: any;
  pluginName?: string;
  execute?: (args: any) => Promise<string>;
  formatArguments?: (args: any) => string;
  generatePreview?: (args: any) => Promise<ToolPreview | null>;
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
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

    if (Config.debug) {
      console.log(`${Config.colors.green}*** Registered ${this.tools.size} internal tools${Config.colors.reset}`);
    }
  }

  /**
   * Add a plugin tool
   */
  addPluginTool(name: string, description: string, parameters: any, execute: (args: any) => Promise<string>, pluginName: string): void {
    this.tools.set(name, {
      type: 'plugin',
      auto_approved: false,
      approval_excludes_arguments: false,
      approval_key_exclude_arguments: [],
      hide_results: false,
      description,
      parameters,
      pluginName,
      execute
    });

    if (Config.debug) {
      console.log(`${Config.colors.green}*** Registered plugin tool: ${name} from ${pluginName}${Config.colors.reset}`);
    }
  }

  /**
   * Get tool definitions for API (internal tools only)
   */
  getToolDefinitions(): any[] {
    const definitions: any[] = [];
    
    for (const [name, toolDef] of this.tools) {
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
  async executeToolCall(toolCall: ToolCall, skipPreview: boolean = false): Promise<ToolResult> {
    const { id, function: func } = toolCall;
    const { name, arguments: args } = func;

    try {
      if (!this.tools.has(name)) {
        throw new Error(`Unknown tool: ${name}`);
      }

      // Get tool definition
      const toolDef = this.tools.get(name)!;
      if (toolDef.type !== 'internal' && toolDef.type !== 'plugin') {
        throw new Error(`External tool ${name} is not supported in this configuration`);
      }

      let argsObj: any;
      try {
        // Validate JSON before parsing
        if (!args || args.trim() === '') {
          argsObj = {};
        } else {
          argsObj = JSON.parse(args);
        }
      } catch (error) {
        console.error(`${Config.colors.red}JSON Parse Error - Raw arguments:${Config.colors.reset}`);
        console.error(`${Config.colors.red}${JSON.stringify(args)}${Config.colors.reset}`);
        throw new Error(`Invalid JSON in tool arguments: ${error}. Raw arguments: ${args.substring(0, 200)}${args.length > 200 ? '...' : ''}`);
      }



      // Call plugin beforeTool hook
      const hookResult = pluginSystem.beforeToolCall(name, argsObj);
      if (hookResult === false) {
        // Plugin wants to cancel the tool call
        return {
          tool_call_id: id,
          content: `Tool call ${name} cancelled by plugin`,
        };
      }

      // Validate required arguments for each tool
      this.validateToolArguments(name, argsObj);

      // Execute the appropriate internal tool or plugin tool
      let toolOutput: ToolOutput;
      try {
        switch (name) {
          case 'read_file':
            toolOutput = await executeReadFile(argsObj, this.stats);
            // Track that we read this file
            this.readFiles.add(argsObj.path);
            break;
          case 'write_file':
            toolOutput = await executeWriteFile(argsObj, this.stats);
            break;
          case 'edit_file':
            toolOutput = await executeEditFile(argsObj, this.stats);
            break;
          case 'run_shell_command':
            toolOutput = await executeRunShellCommand(argsObj, this.stats);
            break;
          case 'grep':
            toolOutput = await executeGrep(argsObj, this.stats);
            break;
          case 'list_directory':
            toolOutput = await executeListDirectory(argsObj, this.stats);
            break;
          default:
            throw new Error(`Internal tool execution not implemented: ${name}`);
        }
      } catch (execError) {
        throw new Error(`Tool execution failed for ${name}: ${execError instanceof Error ? execError.message : String(execError)}`);
      }

      // Format for AI
      let aiResult = ToolFormatter.formatForAI(toolOutput);
      
      // Get friendly message for display
      const friendlyResult = ToolFormatter.formatForDisplay(toolOutput);

      // Call plugin afterTool hook
      const modifiedOutput = pluginSystem.afterToolCall(name, toolOutput);
      if (modifiedOutput !== undefined) {
        // Plugin modified the ToolOutput object
        const modifiedAiResult = ToolFormatter.formatForAI(modifiedOutput);
        const modifiedFriendlyResult = ToolFormatter.formatForDisplay(modifiedOutput);
        return {
          tool_call_id: id,
          content: modifiedAiResult,
          friendly: modifiedFriendlyResult || undefined,
        };
      }

      // Check if result is too large
      const resultSize = Buffer.byteLength(aiResult, 'utf8');
      if (resultSize > Config.maxToolResultSize) {
        if (toolDef.description.includes('file')) {
          aiResult = `ERROR: File content too large (${resultSize} bytes). Maximum ${Config.maxToolResultSize} bytes allowed. Use alternative approach to read specific portions of the file.`;
        } else if (toolDef.description.includes('command')) {
          aiResult = `ERROR: Command output too large (${resultSize} bytes). Maximum ${Config.maxToolResultSize} bytes allowed. Use command options to limit output size.`;
        } else if (toolDef.description.includes('directory')) {
          aiResult = `ERROR: Directory listing too large (${resultSize} bytes). Maximum ${Config.maxToolResultSize} bytes allowed. Navigate to a more specific subdirectory or filter results.`;
        } else {
          aiResult = `ERROR: Tool result too large (${resultSize} bytes). Maximum ${Config.maxToolResultSize} bytes allowed.`;
        }

        if (Config.debug) {
          console.log(`*** Tool result from '${name}' replaced due to size (${resultSize} > ${Config.maxToolResultSize} limit)`);
        }
      }

      return {
        tool_call_id: id,
        content: aiResult,
        friendly: friendlyResult || undefined,
      };

    } catch (error) {
      this.stats.incrementToolErrors();
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
   * Validate tool arguments
   */
  private validateToolArguments(toolName: string, args: any): void {
    switch (toolName) {
      case 'read_file':
        if (!args.path || typeof args.path !== 'string') {
          throw new Error('read_file requires "path" argument (string)');
        }
        if (!this.checkSandbox(toolName, args.path)) {
          throw new Error('read_file: path outside current directory not allowed');
        }
        break;
      case 'write_file':
        if (!args.path || typeof args.path !== 'string') {
          throw new Error('write_file requires "path" argument (string)');
        }
        if (args.content === undefined) {
          throw new Error('write_file requires "content" argument');
        }
        if (!this.checkSandbox(toolName, args.path)) {
          throw new Error('write_file: path outside current directory not allowed');
        }
        
        // Safety: Check if file exists and wasn't read first
        if (this.fileExists(args.path) && !this.wasFileRead(args.path)) {
          throw new Error(`write_file: File "${args.path}" exists but wasn't read first. Read it first to avoid accidental overwrites.`);
        }
        break;
      case 'run_shell_command':
        if (!args.command || typeof args.command !== 'string') {
          throw new Error('run_shell_command requires "command" argument (string)');
        }
        break;
      case 'grep':
        if (!args.text || typeof args.text !== 'string') {
          throw new Error('grep requires "text" argument (string)');
        }
        // Sandbox check is now handled by FileUtils
        break;
      case 'list_directory':
        if (!args.path || typeof args.path !== 'string') {
          throw new Error('list_directory requires "path" argument (string)');
        }
        // Sandbox check is now handled by FileUtils
        break;
    }
  }

  /**
   * Check if path is safe (simple sandbox)
   */
  private checkSandbox(toolName: string, path: string): boolean {
    if (Config.sandboxDisabled) {
      console.log(`${Config.colors.cyan}[!] Sandbox disabled via MINI_SANDBOX=0 - allowing all paths${Config.colors.reset}`);
      return true;
    }

    if (!path) return true;
    
    // Block parent directory traversal
    if (path.includes('../')) {
      console.log(`${Config.colors.yellow}[x] Sandbox: ${toolName} trying to access "${path}" outside current directory${Config.colors.reset}`);
      return false;
    }
    
    // For absolute paths, check if they're within current directory
    if (path.startsWith('/')) {
      if (!path.startsWith(this.currentDir)) {
        console.log(`${Config.colors.yellow}[x] Sandbox: ${toolName} trying to access "${path}" outside current directory${Config.colors.reset}`);
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
  formatToolArguments(toolName: string, args: any): string {
    const toolDef = this.tools.get(toolName);
    if (toolDef?.formatArguments) {
      try {
        // Use custom formatter
        if (typeof args === 'string') {
          // Parse JSON if it's a string (from the API)
          args = JSON.parse(args);
        }
        return toolDef.formatArguments(args);
      } catch (error) {
        // Fallback to JSON if formatter fails
        if (Config.debug) {
          console.log(`${Config.colors.yellow}[!] Custom formatter failed for ${toolName}, falling back to JSON${Config.colors.reset}`);
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
  async generatePreview(toolName: string, args: any): Promise<ToolPreview | null> {
    const toolDef = this.tools.get(toolName);
    if (!toolDef?.generatePreview) {
      return null;
    }

    try {
      const preview = await toolDef.generatePreview(args);
      return preview;
    } catch (error) {
      console.error(`${Config.colors.red}[!] Preview generation failed for ${toolName}: ${error}${Config.colors.reset}`);
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
}