/**
 * System Types - Application Interfaces & Cross-Cutting Concerns
 * 
 * This module contains system-level interfaces, plugin types, and forward
 * declarations needed to break circular dependencies. It serves as the
 * coordination layer for different system components and provides the
 * infrastructure for extensibility and system integration.
 * 
 * Domain: System infrastructure and cross-cutting concerns
 * Responsibilities: Plugin system, AI councils, prompt building, forward declarations, utilities
 * 
 * Note: Contains forward declarations to break circular dependencies between core modules.
 * Each forward declaration documents the interface contract without creating direct imports.
 */

import type { Message, AssistantMessage, ToolResultData } from './message-types.js';

// ============================================================================
// FORWARD DECLARATIONS - Break circular dependencies
// ============================================================================

export interface MessageHistory {
    addSystemMessage(content: string): void;
    addUserMessage(content: string): void;
    addAssistantMessage(message: AssistantMessage): void;
    addToolResults(results: ToolResultData[]): void;
    getMessages(): Message[];
    shouldAutoCompact(): boolean;
    compactMemory(): Promise<void>;
    setApiClient(client: StreamingClient): void;
}

import type { ApiUsage } from './api-types.js';

export interface StreamingClient {
    streamRequest(messages: Message[]): AsyncGenerator<any, void, unknown>;
    resetColorizer(): void;
    processWithColorization(content: string): string;
    updateTokenStats(usage: ApiUsage): void;
}

export interface InputHandler {
    getUserInput(): Promise<string>;
    prompt(message: string): Promise<string>;
    addToHistory(input: string): void;
    close(): void;
    setStatsContext(stats: Stats): void;
    setMessageHistory(history: MessageHistory): void;
}

export interface Stats {
    setLastUserPrompt(prompt: string): void;
    incrementTokensUsed(count: number): void;
    incrementApiCalls(): void;
    incrementToolCalls(): void;
    printStats(): void;
}

// ============================================================================
// PLUGIN TYPES - Plugin system
// ============================================================================

export interface Plugin {
    name: string;
    version: string;
    initialize(context: PluginContext): void | Promise<void>;
    destroy?(): void | Promise<void>;
}

export interface PluginContext {
    config: any;
    registerCommand(name: string, handler: CommandHandler, description?: string): void;
    addUserMessage(message: string): void;
    addSystemMessage(message: string): void;
    getConfig(key: string): string | undefined;
    setConfig(key: string, value: string): void;
    originalWriteFile(path: string, content: string): Promise<void>;
    originalEditFile(path: string, oldStr: string, newStr: string): Promise<void>;
    app: Record<string, unknown>;
    registerNotifyHooks(hooks: NotificationHooks): void;
}

import type { CommandResult } from './tool-types.js';

export type CommandHandler = (args: string[]) => Promise<CommandResult>;

export interface NotificationHooks {
    onBeforeUserPrompt?: () => void | Promise<void>;
    onAfterUserPrompt?: () => void | Promise<void>;
    onBeforeApprovalPrompt?: () => void | Promise<void>;
    onAfterApprovalPrompt?: () => void | Promise<void>;
}

export type HookName = keyof NotificationHooks;

// ============================================================================
// COUNCIL TYPES - AI expert system
// ============================================================================

export interface CouncilMember {
    name: string;
    systemPrompt: string;
    voteWeight?: number;
}

export interface CouncilConfig {
    members: CouncilMember[];
    moderatorPrompt: string;
    maxTokens?: number;
    temperature?: number;
}

export interface CouncilResult {
    consensusMessage: string;
    votingDetails: Array<{
        member: string;
        vote: string;
        reasoning: string;
    }>;
}

// ============================================================================
// PROMPT TYPES - Prompt building
// ============================================================================

export interface PromptContext {
    agentsContent?: string;
    currentDirectory?: string;
    currentDatetime?: string;
    systemInfo?: string;
}

export interface PromptOptions {
    overridePrompt?: string;
}

// ============================================================================
// UTILITY TYPES - Common utilities
// ============================================================================

export type ConfigValue = string | number | boolean | null | undefined;

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export interface ErrorWithMessage extends Error {
    message: string;
}