/**
 * Simple, robust, future-proof plugin system for AI Coder
 * A tool is just a tool - no internal vs plugin distinction needed
 * 
 * Design principles:
 * - Simple: Minimal abstractions, direct API
 * - Robust: Graceful error handling, no plugin crashes
 * - Future-proof: Easy to extend, AI can fix plugins when APIs break
 */

import { ToolDefinition } from './tool-manager.js';
import { Config } from './config.js';
import { ToolOutput } from './tool-formatter.js';

/**
 * Core plugin interface - simple and minimal
 */
export interface Plugin {
  // Required metadata
  name: string;
  version: string;
  description: string;
  
  // Optional lifecycle hooks
  initialize?(): void;
  cleanup?(): void;
  
  // Optional capabilities
  getTools?(): PluginTool[];
  beforeToolCall?(toolName: string, args: any): boolean | void;
  afterToolCall?(toolName: string, result: ToolOutput): ToolOutput | void;
  // Add more hooks as needed without breaking existing plugins
  beforeFileWrite?(path: string, content: string): string | void;
  afterFileWrite?(path: string, content: string): void;
  // ... future hooks can be added here
}

/**
 * Simple tool definition
 */
export interface PluginTool {
  name: string;
  description: string;
  parameters: any;
  execute(args: any): Promise<string>;
}

/**
 * Plugin context - provides access to app internals
 */
export interface PluginContext {
  // Config access - direct access to app config
  config: Config;
  
  // Commands
  registerCommand(name: string, handler: (args: string[]) => boolean | void, description?: string): void;
  
  // Messages
  addUserMessage(message: string): void;
  addSystemMessage(message: string): void;
  
  // Configuration
  getConfig(key: string): any;
  setConfig(key: string, value: any): void;
  
  // File operations (intercepted)
  originalWriteFile: (path: string, content: string) => Promise<string>;
  originalEditFile: (path: string, oldStr: string, newStr: string) => Promise<string>;
  
  // App reference for advanced use cases
  app?: any;
}

class PluginSystem {
  private plugins: Map<string, Plugin> = new Map();
  private tools: Map<string, PluginTool> = new Map();
  private context: PluginContext;

  constructor() {
    this.context = this.createContext();
  }

  /**
   * Load plugins from ~/.config/aicoder-mini/plugins/
   */
  async loadPlugins(): Promise<void> {
    const os = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs');

    // Set env var so plugins can find us
    process.env.AICODER_ROOT = path.resolve(__dirname, '../..');
    
    const pluginsDir = path.join(os.homedir(), '.config', 'aicoder-mini', 'plugins');

    try {
      if (!fs.existsSync(pluginsDir)) {
        if (Config.debug) {
          console.log(`${Config.colors.yellow}[*] No plugins directory: ${pluginsDir}${Config.colors.reset}`);
          console.log(`${Config.colors.cyan}[*] Create it to install plugins: mkdir -p "${pluginsDir}"${Config.colors.reset}`);
        }
        return;
      }

      const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
      let loadedCount = 0;

      for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          await this.loadPlugin(path.join(pluginsDir, entry.name));
          loadedCount++;
        }
      }

      if (Config.debug) {
        console.log(`${Config.colors.green}[*] Loaded ${loadedCount} plugins${Config.colors.reset}`);
      }
    } catch (error) {
      console.log(`${Config.colors.red}[x] Plugin loading failed: ${error}${Config.colors.reset}`);
    }
  }

  /**
   * Load a single plugin file
   */
  private async loadPlugin(filePath: string): Promise<void> {
    try {
      // Clear require cache for development
      delete require.cache[require.resolve(filePath)];
      
      const module = await import(filePath);
      
      // Handle new approach: createPlugin(context) function
      if (typeof module.default === 'function') {
        const plugin = module.default(this.context);
        
        if (this.isValidPlugin(plugin)) {
          this.plugins.set(plugin.name, plugin);
          console.log(`${Config.colors.green}[+] Plugin: ${plugin.name} v${plugin.version}${Config.colors.reset}`);
        }
      } else {
        // Fallback to old approach
        const plugin = module.default || module.plugin || module;

        if (this.isValidPlugin(plugin)) {
          this.plugins.set(plugin.name, plugin);

          // Initialize plugin with context
          if (plugin.initialize) {
            try {
              plugin.initialize();
            } catch (error) {
              console.log(`${Config.colors.red}[x] Plugin ${plugin.name} init failed: ${error}${Config.colors.reset}`);
              return;
            }
          }

          // Register tools
          if (plugin.getTools) {
            try {
              const tools = plugin.getTools();
              for (const tool of tools) {
                this.tools.set(tool.name, tool);
              }
            } catch (error) {
              console.log(`${Config.colors.red}[x] Plugin ${plugin.name} tools failed: ${error}${Config.colors.reset}`);
            }
          }

          console.log(`${Config.colors.green}[+] Plugin: ${plugin.name} v${plugin.version}${Config.colors.reset}`);
        }
      }
    } catch (error) {
      console.log(`${Config.colors.red}[x] Failed to load ${filePath}: ${error}${Config.colors.reset}`);
    }
  }

  /**
   * Check if object is a valid plugin
   */
  private isValidPlugin(obj: any): obj is Plugin {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.name === 'string' &&
      typeof obj.version === 'string' &&
      typeof obj.description === 'string'
    );
  }

  /**
   * Create plugin context
   */
  private createContext(): PluginContext {
    // Will be properly initialized when AICoder integrates
    return {
      config: Config,  // Add config reference
      registerCommand: () => {},
      addUserMessage: () => {},
      addSystemMessage: () => {},
      getConfig: () => undefined,
      setConfig: () => {},
      originalWriteFile: async () => '',
      originalEditFile: async () => '',
      app: undefined
    };
  }

  /**
   * Update context with real implementations
   */
  setContext(context: Partial<PluginContext>): void {
    Object.assign(this.context, context);
  }

  /**
   * Get all tools (internal + plugins)
   */
  getAllTools(): Map<string, PluginTool> {
    return this.tools;
  }

  /**
   * Execute a tool (internal or plugin)
   */
  async executeTool(name: string, args: any): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    try {
      return await tool.execute(args);
    } catch (error) {
      console.log(`${Config.colors.red}[x] Tool ${name} failed: ${error}${Config.colors.reset}`);
      throw error;
    }
  }

  /**
   * Get tool definitions for all tools (for AI)
   */
  getToolDefinitions(): ToolDefinition[] {
    const definitions: ToolDefinition[] = [];

    for (const [name, tool] of this.tools) {
      definitions.push({
        type: 'tool',
        auto_approved: false,
        approval_excludes_arguments: false,
        approval_key_exclude_arguments: [],
        hide_results: false,
        description: tool.description,
        parameters: tool.parameters,
        execute: tool.execute
      });
    }

    return definitions;
  }

  /**
   * Hook before tool call
   */
  beforeToolCall(toolName: string, args: any): boolean | void {
    for (const plugin of this.plugins.values()) {
      try {
        if (plugin.beforeToolCall) {
          const result = plugin.beforeToolCall(toolName, args);
          if (result === false) {
            return false; // Cancel
          }
        }
      } catch (error) {
        console.log(`${Config.colors.red}[x] Plugin ${plugin.name} beforeToolCall failed: ${error}${Config.colors.reset}`);
      }
    }
  }

  /**
   * Hook after tool call
   */
  afterToolCall(toolName: string, result: ToolOutput): ToolOutput | void {
    let modifiedResult = result;
    
    for (const plugin of this.plugins.values()) {
      try {
        if (plugin.afterToolCall) {
          const pluginResult = plugin.afterToolCall(toolName, modifiedResult);
          if (pluginResult !== undefined) {
            modifiedResult = pluginResult;
          }
        }
      } catch (error) {
        console.log(`${Config.colors.red}[x] Plugin ${plugin.name} afterToolCall failed: ${error}${Config.colors.reset}`);
      }
    }
    
    return modifiedResult;
  }

  /**
   * Hook before file write
   */
  beforeFileWrite(path: string, content: string): string | void {
    let modifiedContent = content;
    
    for (const plugin of this.plugins.values()) {
      try {
        if (plugin.beforeFileWrite) {
          const pluginResult = plugin.beforeFileWrite(path, modifiedContent);
          if (pluginResult !== undefined) {
            modifiedContent = pluginResult;
          }
        }
      } catch (error) {
        console.log(`${Config.colors.red}[x] Plugin ${plugin.name} beforeFileWrite failed: ${error}${Config.colors.reset}`);
      }
    }
    
    return modifiedContent;
  }

  /**
   * Hook after file write
   */
  afterFileWrite(path: string, content: string): void {
    for (const plugin of this.plugins.values()) {
      try {
        if (plugin.afterFileWrite) {
          plugin.afterFileWrite(path, content);
        }
      } catch (error) {
        console.log(`${Config.colors.red}[x] Plugin ${plugin.name} afterFileWrite failed: ${error}${Config.colors.reset}`);
      }
    }
  }

  /**
   * Register a tool (for internal tools)
   */
  registerTool(name: string, tool: PluginTool): void {
    this.tools.set(name, tool);
  }

  /**
   * Get plugin context
   */
  getContext(): PluginContext {
    return this.context;
  }

  /**
   * Cleanup all plugins
   */
  async cleanup(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        if (plugin.cleanup) {
          plugin.cleanup();
        }
      } catch (error) {
        console.log(`${Config.colors.red}[x] Plugin ${plugin.name} cleanup failed: ${error}${Config.colors.reset}`);
      }
    }
    
    this.plugins.clear();
    this.tools.clear();
  }
}

export const pluginSystem = new PluginSystem();