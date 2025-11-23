/**
 * Common TypeScript types for AI Coder
 * Centralized type definitions to replace 'any' usage
 */

// Base types for API responses
export interface ApiUsage {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
}

// Tool call related types
export interface ToolCallFunction {
    name?: string;
    arguments?: string;
}

export interface ToolCall {
    id: string;
    type: string;
    function: ToolCallFunction;
}

// Tool parameter types - more specific than any
export type ToolParameters = Record<string, unknown>;

// Message tool calls - same as ToolCall but with index
export interface MessageToolCall extends ToolCall {
    index: number;
}

// Assistant message structure
export interface AssistantMessage {
    content?: string;
    tool_calls?: MessageToolCall[];
}

// Tool result structure
export interface ToolResultData {
    tool_call_id: string;
    content: string;
}

// API request data structure
export interface ApiRequestData {
    model: string;
    messages: Array<{
        role: string;
        content?: string;
        tool_calls?: MessageToolCall[];
        tool_call_id?: string;
    }>;
    tools?: Array<{
        type: string;
        function: {
            name: string;
            description: string;
            parameters: ToolParameters;
        };
    }>;
    tool_choice?: string;
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
}

// Configuration value types
export type ConfigValue = string | number | boolean | null | undefined;

// Plugin-related types
export type PluginCommandHandler = (args: string[]) => boolean | undefined;

// Plugin context with hook registration
export interface ExtendedPluginContext {
    registerNotifyHooks?(hooks: NotificationHooks): void;
}

// Error types
export interface ErrorWithMessage extends Error {
    message: string;
}

// Utility type for better error handling
export type UnknownError = unknown;

// Readline interface types
export interface ReadlineInterface {
    on(event: 'SIGINT' | 'SIGTSTP', callback: () => void): void;
    on(event: string, callback: (...args: any[]) => void): void;
    close(): void;
    prompt(): void;
    write(data: string): void;
    question(message: string, callback: (answer: string) => void): void;
    history?: string[];
}

// Completion callback type
export type CompletionCallback = (err: Error | null, result?: [string[], string]) => void;

// Stream chunk choices
export interface StreamChoice {
    delta?: {
        content?: string;
        tool_calls?: MessageToolCall[];
    };
    finish_reason?: string;
}

// Enhanced stream chunk
export interface StreamChunkData {
    choices?: StreamChoice[];
    usage?: ApiUsage;
}

// Hook return types
export type HookResult = boolean | void;
export type ToolOutputResult = string | void;

// Plugin tool execution arguments
export interface ToolExecutionArgs extends Record<string, unknown> {
    [key: string]: unknown;
}

// Validation function result
export interface ValidationResult {
    valid: boolean;
    error?: string;
}

// Notification hooks interface
export interface NotificationHooks {
    onBeforeUserPrompt?(): Promise<void>;
    onBeforeApprovalPrompt?(): Promise<void>;
}

// Hook name type
export type HookName = keyof NotificationHooks;
