/**
 * Plugin System for AI Coder
 *
 * IMPORTANT: There is only ONE plugin API. If this API changes,
 * all plugins MUST be updated to match. No legacy support is provided.
 *
 * Design principles:
 * - Simple: Minimal abstractions, direct API
 * - Robust: Graceful error handling, no plugin crashes
 * - Single API: One way to create plugins, no backward compatibility
 */

import type { ToolDefinition } from './tool-manager.js';
import { Config } from './config.js';
import { LogUtils } from '../utils/log-utils.js';
import type { ToolOutput } from './tool-formatter.js';
import type {
    ToolParameters,
    PluginCommandHandler,
    HookResult,
    ToolOutputResult,
    ToolExecutionArgs,
    ConfigValue,
    NotificationHooks,
} from './types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Core plugin interface - simple and minimal
 * ALL plugins MUST implement this interface
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
    beforeToolCall?(toolName: string, args: ToolExecutionArgs): HookResult;
    afterToolCall?(toolName: string, result: ToolOutput): ToolOutputResult;
    beforeFileWrite?(path: string, content: string): ToolOutputResult;
    afterFileWrite?(path: string, content: string): void;
    // Note: Future hooks can be added here - plugins must implement them if needed
}

/**
 * Simple tool definition for plugins
 */
export interface PluginTool {
    name: string;
    description: string;
    parameters: ToolParameters;
    execute(args: ToolExecutionArgs): Promise<string>;
    auto_approved?: boolean; // Whether tool is auto-approved (default: false)
}

/**
 * Plugin context - provides access to app internals
 * This is passed to the createPlugin function
 */
export interface PluginContext {
    // Config access - direct access to app config
    config: typeof Config;

    // Commands
    registerCommand(name: string, handler: PluginCommandHandler, description?: string): void;

    // Messages
    addUserMessage(message: string): void;
    addSystemMessage(message: string): void;

    // Configuration
    getConfig(key: string): ConfigValue;
    setConfig(key: string, value: ConfigValue): void;

    // File operations (intercepted)
    originalWriteFile: (path: string, content: string) => Promise<string>;
    originalEditFile: (path: string, oldStr: string, newStr: string) => Promise<string>;

    // App reference for advanced use cases
    app?: Record<string, unknown>;

    // Notification hooks (optional)
    registerNotifyHooks?(hooks: NotificationHooks): void;
}

/**
 * Plugin creation function signature
 * ALL plugins MUST export a default function with this signature
 */
export type CreatePluginFunction = (context: PluginContext) => Plugin;

class PluginSystem {
    private plugins: Map<string, Plugin> = new Map();
    private tools: Map<string, PluginTool> = new Map();
    private context: PluginContext;

    constructor() {
        this.context = this.createContext();
    }

    /**
     * Load plugins from ~/.config/aicoder-mini/plugins/
     * Loads plugins synchronously, one at a time to prevent race conditions
     *
     * IMPORTANT: Plugins MUST export a default function: createPlugin(context)
     * No other export formats are supported.
     */
    loadPlugins(): void {
        // Set env var so plugins can find us
        process.env.AICODER_ROOT = path.resolve(__dirname, '../..');

        const pluginsDir = path.join(os.homedir(), '.config', 'aicoder-mini', 'plugins');

        try {
            if (!fs.existsSync(pluginsDir)) {
                if (Config.debug) {
                    LogUtils.warn(`[*] No plugins directory: ${pluginsDir}`);
                    LogUtils.print(`[*] Create it to install plugins: mkdir -p "${pluginsDir}"`, {
                        color: Config.colors.cyan,
                    });
                }
                return;
            }

            const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
            let loadedCount = 0;

            for (const entry of entries) {
                if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
                    this.loadPlugin(path.join(pluginsDir, entry.name));
                    loadedCount++;
                }
            }

            if (Config.debug) {
                LogUtils.success(`[*] Loaded ${loadedCount} plugins`);
            }
        } catch (error) {
            LogUtils.error(`[x] Plugin loading failed: ${error}`);
        }
    }

    /**
     * Load a single plugin file
     *
     * IMPORTANT: Plugin MUST export default createPlugin(context) function
     * No legacy formats are supported.
     */
    private loadPlugin(filePath: string): void {
        try {
            // Clear require cache for development
            delete require.cache[require.resolve(filePath)];

            const module = require(filePath);

            // ONLY support the new API: createPlugin(context) function
            if (typeof module.default === 'function') {
                const plugin = module.default(this.context);

                if (this.isValidPlugin(plugin)) {
                    this.plugins.set(plugin.name, plugin);

                    // Initialize plugin if it has an initialize method
                    if (plugin.initialize) {
                        try {
                            plugin.initialize();
                        } catch (error) {
                            LogUtils.error(`[x] Plugin ${plugin.name} init failed: ${error}`);
                            // Remove failed plugin
                            this.plugins.delete(plugin.name);
                            return;
                        }
                    }

                    // Register tools if plugin provides them
                    if (plugin.getTools) {
                        try {
                            const tools = plugin.getTools();
                            for (const tool of tools) {
                                this.tools.set(tool.name, tool);
                            }
                        } catch (error) {
                            LogUtils.error(`[x] Plugin ${plugin.name} tools failed: ${error}`);
                        }
                    }

                    LogUtils.success(`[+] Plugin: ${plugin.name} v${plugin.version}`);
                } else {
                    LogUtils.error(
                        `[x] Invalid plugin format in ${filePath}: Must implement Plugin interface`
                    );
                }
            } else {
                LogUtils.error(
                    `[x] Invalid plugin format in ${filePath}: Must export default createPlugin(context) function`
                );
            }
        } catch (error) {
            LogUtils.error(`[x] Failed to load ${filePath}: ${error}`);
        }
    }

    /**
     * Check if object is a valid plugin
     */
    private isValidPlugin(obj: unknown): obj is Plugin {
        return (obj &&
            typeof obj === 'object' &&
            typeof (obj as Plugin).name === 'string' &&
            typeof (obj as Plugin).version === 'string' &&
            typeof (obj as Plugin).description === 'string') as boolean;
    }

    /**
     * Create plugin context
     */
    private createContext(): PluginContext {
        // Will be properly initialized when AICoder integrates
        return {
            config: Config,
            registerCommand: () => {},
            addUserMessage: () => {},
            addSystemMessage: () => {},
            getConfig: () => undefined,
            setConfig: () => {},
            originalWriteFile: async () => '',
            originalEditFile: async () => '',
            app: undefined,
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
        if (Config.debug) {
            console.log(
                `[DEBUG] getAllTools() returning ${this.tools.size} tools:`,
                Array.from(this.tools.keys())
            );
        }
        return this.tools;
    }

    /**
     * Execute a tool (internal or plugin)
     */
    async executeTool(name: string, args: ToolExecutionArgs): Promise<string> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }

        try {
            return await tool.execute(args);
        } catch (error) {
            LogUtils.error(`[x] Tool ${name} failed: ${error}`);
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
                type: 'plugin',
                auto_approved: tool.auto_approved || false,
                approval_excludes_arguments: false,
                approval_key_exclude_arguments: [],
                hide_results: false,
                description: tool.description,
                parameters: tool.parameters,
                execute: async (args: ToolExecutionArgs): Promise<ToolOutput> => {
                    const result = await tool.execute(args);
                    // Convert plugin string result to ToolOutput
                    return {
                        tool: name,
                        friendly: `✓ Plugin tool ${name} executed`,
                        important: {},
                        results: {
                            content: result,
                            showWhenDetailOff: true,
                        },
                    };
                },
            });
        }

        return definitions;
    }

    /**
     * Hook before tool call
     */
    beforeToolCall(toolName: string, args: ToolExecutionArgs): HookResult {
        for (const plugin of this.plugins.values()) {
            try {
                if (plugin.beforeToolCall) {
                    const result = plugin.beforeToolCall(toolName, args);
                    if (result === false) {
                        return false; // Cancel
                    }
                }
            } catch (error) {
                LogUtils.error(`[x] Plugin ${plugin.name} beforeToolCall failed: ${error}`);
            }
        }
    }

    /**
     * Hook after tool call
     */
    afterToolCall(toolName: string, result: ToolOutput): ToolOutputResult {
        let modifiedResult = result;

        for (const plugin of this.plugins.values()) {
            try {
                if (plugin.afterToolCall) {
                    const pluginResult = plugin.afterToolCall(toolName, modifiedResult);
                    if (pluginResult !== undefined) {
                        modifiedResult = pluginResult as unknown as ToolOutput;
                    }
                }
            } catch (error) {
                LogUtils.error(`[x] Plugin ${plugin.name} afterToolCall failed: ${error}`);
            }
        }

        return modifiedResult as unknown as ToolOutputResult;
    }

    /**
     * Hook before file write
     */
    beforeFileWrite(path: string, content: string): ToolOutputResult {
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
                LogUtils.error(`[x] Plugin ${plugin.name} beforeFileWrite failed: ${error}`);
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
                LogUtils.error(`[x] Plugin ${plugin.name} afterFileWrite failed: ${error}`);
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
     * Cleanup all plugins synchronously
     */
    cleanup(): void {
        for (const plugin of this.plugins.values()) {
            try {
                if (plugin.cleanup) {
                    plugin.cleanup();
                }
            } catch (error) {
                LogUtils.error(`[x] Plugin ${plugin.name} cleanup failed: ${error}`);
            }
        }

        this.plugins.clear();
        this.tools.clear();
    }
}

export const pluginSystem = new PluginSystem();
