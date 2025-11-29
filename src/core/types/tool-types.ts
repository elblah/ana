/**
 * Tool Types - Tool System & CLI Interactions
 * 
 * This module combines tool execution system types with CLI interaction types,
 * as both represent user-facing functionality. The tool system handles
 * definition, execution, and output formatting, while CLI types manage
 * command-line interactions and user input/output.
 * 
 * Domain: Tool execution and CLI interactions
 * Responsibilities: Tool definitions, execution workflow, user input handling, command results
 */

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: ToolParameters;
    execute: (args: ToolExecutionArgs) => Promise<ToolOutput>;
    generatePreview?: (args: any) => Promise<ToolPreview | null>;
    auto_approved?: boolean;
    hide_results?: boolean;
}

export interface ToolParameters {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
}

export interface ToolExecutionArgs {
    preview_mode?: boolean;
    [key: string]: unknown;
}

export interface ToolOutput {
    content: string;
    friendly?: string;
}

export interface ToolPreview {
    content: string;
    canApprove: boolean;
}

// CLI & Command related types
export interface ReadlineInterface {
    prompt(query: string): Promise<string>;
    close(): void;
    setPrompt(prompt: string): void;
    write(data: string): void;
    // Legacy interface for compatibility
    on(event: 'SIGINT' | 'SIGTSTP', callback: () => void): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
    question(message: string, callback: (answer: string) => void): void;
    history?: string[];
}

export interface CompletionCallback {
    (line: string): string[];
    // Legacy callback for compatibility
    (err: Error | null, result?: [string[], string]): void;
}

export interface CommandResult {
    shouldQuit?: boolean;
    runApiCall?: boolean;
    message?: string;
}