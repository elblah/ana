/**
 * Message history management for AI Coder
 * Simple storage with delegated compaction logic
 */

import type { Stats } from './stats.js';
import { CompactionService } from './compaction-service.js';
import { Config } from './config.js';
import { estimateMessagesTokens, clearTokenCache, estimateTokens } from './token-estimator.js';
import type { MessageToolCall, AssistantMessage, ToolResultData } from './types.js';
import type { StreamingClient } from './streaming-client.js';

/**
 * Message used to replace pruned tool result content
 */
export const PRUNED_TOOL_MESSAGE = '[Old tool result content cleared due to memory compaction]';

/**
 * Minimum size for tool result to be considered for pruning
 * Tool results smaller than this are protected from pruning
 */
export const PRUNE_PROTECTION_THRESHOLD = 256; // bytes

export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: string;
    tool_calls?: MessageToolCall[];
    tool_call_id?: string;
}

export class MessageHistory {
    private messages: Message[] = [];
    private initialSystemPrompt: Message | null = null;
    private stats: Stats;
    private compactionCount = 0;
    private apiClient: StreamingClient | null = null;
    private isCompacting = false; // Prevent concurrent compactions

    constructor(stats: Stats, apiClient?: StreamingClient) {
        this.stats = stats;
        this.apiClient = apiClient || null;
    }

    /**
     * Set API client reference for compaction
     */
    setApiClient(apiClient: StreamingClient): void {
        this.apiClient = apiClient;
    }

    /**
     * Add a system message
     */
    addSystemMessage(content: string): void {
        const message: Message = { role: 'system', content };
        this.messages.push(message);
        this.estimateContext();

        if (!this.initialSystemPrompt) {
            this.initialSystemPrompt = message;
        }
    }

    /**
     * Add a user message
     */
    addUserMessage(content: string): void {
        const message: Message = { role: 'user', content };
        this.messages.push(message);
        this.stats.incrementMessagesSent();
        // Update context size estimate
        this.estimateContext();
    }

    /**
     * Add an assistant message
     */
    addAssistantMessage(message: AssistantMessage): void {
        const assistantMessage: Message = {
            role: 'assistant',
            content: message.content,
            tool_calls: message.tool_calls,
        };
        this.messages.push(assistantMessage);
        // Update context size estimate
        this.estimateContext();
    }

    /**
     * Add tool results
     */
    addToolResults(toolResults: ToolResultData[]): void {
        for (const result of toolResults) {
            const toolMessage: Message = {
                role: 'tool',
                content: result.content,
                tool_call_id: result.tool_call_id,
            };
            this.messages.push(toolMessage);
        }
        // Update context size estimate
        this.estimateContext();
    }

    /**
     * Get all messages
     */
    getMessages(): Message[] {
        return [...this.messages];
    }

    /**
     * Get messages excluding initial system prompt
     */
    getChatMessages(): Message[] {
        if (!this.initialSystemPrompt || this.messages.length <= 1) {
            return this.messages;
        }
        return this.messages.slice(1);
    }

    /**
     * Estimate context size in tokens
     */
    estimateContext(): void {
        try {
            // Enhanced token estimation using the new token estimator
            // Guard against invalid values
            if (!this.messages || this.messages.length === 0) {
                this.stats.setCurrentPromptSize(0, true);
                return;
            }

            const estimatedTokens = estimateMessagesTokens(this.messages);

            // Cap at reasonable maximum to prevent display issues
            const cappedTokens = Math.min(estimatedTokens, 9999999);

            this.stats.setCurrentPromptSize(cappedTokens, true);
        } catch (error) {
            // If JSON.stringify fails, reset to 0
            this.stats.setCurrentPromptSize(0, true);
        }
    }

    /**
     * Clear all messages
     */
    clear(): void {
        this.messages = [];
        this.initialSystemPrompt = null;
        this.compactionCount = 0;
        clearTokenCache();
    }

    /**
     * Directly set messages (useful for loading sessions and compaction)
     */
    setMessages(messages: Message[]): void {
        this.messages = [...messages];
        // Clear token cache when messages are replaced to prevent stale cache entries
        clearTokenCache();
        // Update context size estimate when messages are set
        this.estimateContext();

        // Set initial system prompt if present
        if (messages.length > 0 && messages[0].role === 'system') {
            this.initialSystemPrompt = messages[0];
        } else {
            this.initialSystemPrompt = null;
        }
    }

    /**
     * Get message count
     */
    getMessageCount(): number {
        return this.messages.length;
    }

    /**
     * Get chat message count (excluding system)
     */
    getChatMessageCount(): number {
        return this.getChatMessages().length;
    }

    /**
     * Get the initial system prompt
     */
    getInitialSystemPrompt(): Message | null {
        return this.initialSystemPrompt;
    }

    /**
     * Increment compaction counter
     */
    incrementCompactionCount(): void {
        this.compactionCount++;
    }

    /**
     * Get compaction count
     */
    getCompactionCount(): number {
        return this.compactionCount;
    }

    /**
     * Compact memory using CompactionService
     */
    async compactMemory(): Promise<void> {
        // Prevent concurrent compactions
        if (this.isCompacting) {
            console.log('[!] Compaction already in progress, skipping...');
            return;
        }

        if (!this.apiClient) {
            console.log('[!] API client not available for compaction');
            return;
        }

        this.isCompacting = true;
        try {
            const compaction = new CompactionService(this.apiClient);
            const originalCount = this.messages.length;

            const newMessages = await compaction.compact(this.messages);
            this.setMessages(newMessages);

            if (this.messages.length < originalCount) {
                this.compactionCount++;
                console.log('[✓] Conversation compacted successfully');
            }
        } finally {
            this.isCompacting = false;
        }
    }

    /**
     * Force compact N oldest rounds
     */
    async forceCompactRounds(n: number): Promise<void> {
        if (!this.apiClient) {
            console.log('[!] API client not available for compaction');
            return;
        }

        const compaction = new CompactionService(this.apiClient);
        const originalCount = this.messages.length;

        const newMessages = await compaction.forceCompactRounds(this.messages, n);
        this.setMessages(newMessages);

        if (this.messages.length < originalCount) {
            this.compactionCount++;
            console.log(`[✓] Force compacted ${n} round(s)`);
        }
    }

    /**
     * Force compact N oldest messages
     */
    async forceCompactMessages(n: number): Promise<void> {
        if (!this.apiClient) {
            console.log('[!] API client not available for compaction');
            return;
        }

        const compaction = new CompactionService(this.apiClient);
        const originalCount = this.messages.length;

        const newMessages = await compaction.forceCompactMessages(this.messages, n);
        this.setMessages(newMessages);

        if (this.messages.length < originalCount) {
            this.compactionCount++;
            console.log(`[✓] Force compacted ${n} message(s)`);
        }
    }

    /**
     * Check if auto-compaction should be triggered
     */
    shouldAutoCompact(): boolean {
        if (!Config.autoCompactEnabled) {
            return false;
        }
        return this.stats.currentPromptSize >= Config.autoCompactThreshold;
    }

    /**
     * Get number of conversation rounds
     * A round = user message + assistant response (including tools)
     */
    getRoundCount(): number {
        const chatMessages = this.getChatMessages();
        let rounds = 0;
        let inUserMessage = false;

        for (const message of chatMessages) {
            if (message.role === 'user') {
                if (!inUserMessage) {
                    rounds++;
                    inUserMessage = true;
                }
            } else {
                inUserMessage = false;
            }
        }

        return rounds;
    }

    /**
     * Get all tool result messages
     */
    getToolResultMessages(): Message[] {
        return this.messages.filter((msg) => msg.role === 'tool');
    }

    /**
     * Get tool call statistics
     */
    getToolCallStats(): { count: number; tokens: number; bytes: number } {
        const toolMessages = this.getToolResultMessages();
        const count = toolMessages.length;

        let totalContent = '';
        for (const msg of toolMessages) {
            totalContent += msg.content || '';
        }

        const bytes = new Blob([totalContent]).size;
        const tokens = estimateTokens(totalContent);

        return { count, tokens, bytes };
    }

    /**
     * Replace tool result content with pruning message
     */
    pruneToolResults(indices: number[]): number {
        const toolMessages = this.getToolResultMessages();
        let prunedCount = 0;

        for (const index of indices) {
            if (index >= 0 && index < toolMessages.length) {
                const toolMessage = toolMessages[index];
                const messageIndex = this.messages.findIndex((msg) => msg === toolMessage);
                if (messageIndex !== -1) {
                    const currentContent = this.messages[messageIndex].content || '';
                    const currentSize = new TextEncoder().encode(currentContent).length;
                    // Only prune if content is larger than both the pruning message AND protection threshold
                    if (
                        currentSize >
                        Math.max(PRUNED_TOOL_MESSAGE.length, PRUNE_PROTECTION_THRESHOLD)
                    ) {
                        this.messages[messageIndex].content = PRUNED_TOOL_MESSAGE;
                        prunedCount++;
                    }
                }
            }
        }

        // Only update context if we actually pruned something
        if (prunedCount > 0) {
            clearTokenCache();
            this.estimateContext();
        }

        return prunedCount;
    }

    /**
     * Prune all tool results
     */
    pruneAllToolResults(): number {
        const toolMessages = this.getToolResultMessages();
        const indices = toolMessages.map((_, index) => index);
        return this.pruneToolResults(indices);
    }

    /**
     * Prune N oldest tool results
     */
    pruneOldestToolResults(n: number): number {
        const toolMessages = this.getToolResultMessages();
        const count = Math.min(n, toolMessages.length);
        const indices = Array.from({ length: count }, (_, i) => i);
        return this.pruneToolResults(indices);
    }

    /**
     * Prune a percentage of large tool results (only ones >256 bytes)
     * Returns object with count and bytes saved
     */
    pruneToolResultsByPercentage(targetPercentage: number = 50): {
        prunedCount: number;
        savedBytes: number;
        protectedCount: number;
    } {
        const toolMessages = this.getToolResultMessages();

        if (toolMessages.length === 0) {
            return { prunedCount: 0, savedBytes: 0, protectedCount: 0 };
        }

        // Find indices of tool results that are large enough to prune
        const largeToolIndices: number[] = [];
        toolMessages.forEach((msg, index) => {
            const size = new TextEncoder().encode(msg.content || '').length;
            if (size > PRUNE_PROTECTION_THRESHOLD) {
                largeToolIndices.push(index);
            }
        });

        if (largeToolIndices.length === 0) {
            return { prunedCount: 0, savedBytes: 0, protectedCount: toolMessages.length };
        }

        // Calculate how many to prune (50% of large tool results)
        let toPrune = Math.floor(largeToolIndices.length * (targetPercentage / 100));

        // Ensure at least 1 gets pruned if there are large results remaining
        if (toPrune === 0 && largeToolIndices.length > 0) {
            toPrune = 1;
        }

        if (toPrune === 0) {
            return { prunedCount: 0, savedBytes: 0, protectedCount: toolMessages.length };
        }

        // Calculate potential savings
        const totalBytesBefore = largeToolIndices.slice(0, toPrune).reduce((sum, idx) => {
            return sum + new TextEncoder().encode(toolMessages[idx].content || '').length;
        }, 0);

        // Prune using specific indices of large tool results
        const indicesToPrune = largeToolIndices.slice(0, toPrune);
        const prunedCount = this.pruneToolResults(indicesToPrune);

        const savedBytes =
            totalBytesBefore - prunedCount * new TextEncoder().encode(PRUNED_TOOL_MESSAGE).length;
        const protectedCount = toolMessages.length - largeToolIndices.length;

        return { prunedCount, savedBytes, protectedCount };
    }
}
