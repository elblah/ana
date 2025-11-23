/**
 * Statistics tracking for AI Coder
 */

import type { ApiUsage } from './types.js';

export class Stats {
    public apiRequests = 0;
    public apiSuccess = 0;
    public apiErrors = 0;
    public apiTimeSpent = 0;
    public toolCalls = 0;
    public toolErrors = 0;
    public toolTimeSpent = 0;
    public messagesSent = 0;
    public tokensProcessed = 0;
    public compactions = 0;
    public promptTokens = 0;
    public completionTokens = 0;
    public currentPromptSize = 0;
    public currentPromptSizeEstimated = false;
    public lastUserPrompt = '';
    public usageInfos: Array<{ time: number; usage: ApiUsage }> = [];

    /**
     * Increment API request counter
     */
    incrementApiRequests(): void {
        this.apiRequests++;
    }

    /**
     * Increment API success counter
     */
    incrementApiSuccess(): void {
        this.apiSuccess++;
    }

    /**
     * Increment API error counter
     */
    incrementApiErrors(): void {
        this.apiErrors++;
    }

    /**
     * Add time to API time spent
     */
    addApiTime(time: number): void {
        this.apiTimeSpent += time;
    }

    /**
     * Increment tool calls counter
     */
    incrementToolCalls(): void {
        this.toolCalls++;
    }

    /**
     * Increment tool errors counter
     */
    incrementToolErrors(): void {
        this.toolErrors++;
    }

    /**
     * Add time to tool time spent
     */
    addToolTime(time: number): void {
        this.toolTimeSpent += time;
    }

    /**
     * Increment messages sent counter
     */
    incrementMessagesSent(): void {
        this.messagesSent++;
    }

    /**
     * Add tokens to processed counter
     */
    addTokensProcessed(tokens: number): void {
        this.tokensProcessed += tokens;
    }

    /**
     * Increment compactions counter
     */
    incrementCompactions(): void {
        this.compactions++;
    }

    /**
     * Add prompt tokens
     */
    addPromptTokens(tokens: number): void {
        this.promptTokens += tokens;
    }

    /**
     * Add completion tokens
     */
    addCompletionTokens(tokens: number): void {
        this.completionTokens += tokens;
    }

    /**
     * Set current prompt size
     */
    setCurrentPromptSize(size: number, estimated = false): void {
        this.currentPromptSize = size;
        this.currentPromptSizeEstimated = estimated;
    }

    /**
     * Store last user prompt
     */
    setLastUserPrompt(prompt: string): void {
        this.lastUserPrompt = prompt;
    }

    /**
     * Add usage info
     */
    addUsageInfo(usage: ApiUsage): void {
        this.usageInfos.push({ time: Date.now(), usage });
    }

    /**
     * Print statistics on exit
     */
    printStats(): void {
        console.log('\n=== Session Statistics ===');
        console.log(
            `API Requests: ${this.apiRequests} (Success: ${this.apiSuccess}, Errors: ${this.apiErrors})`
        );
        console.log(`API Time Spent: ${this.apiTimeSpent.toFixed(2)}s`);
        console.log(`Tool Calls: ${this.toolCalls} (Errors: ${this.toolErrors})`);
        console.log(`Tool Time Spent: ${this.toolTimeSpent.toFixed(2)}s`);
        console.log(`Messages Sent: ${this.messagesSent}`);
        console.log(`Tokens Processed: ${this.tokensProcessed.toLocaleString()}`);
        console.log(`Prompt Tokens: ${this.promptTokens.toLocaleString()}`);
        console.log(`Completion Tokens: ${this.completionTokens.toLocaleString()}`);
        console.log(`Compactions: ${this.compactions}`);
        if (this.currentPromptSize > 0) {
            const estimated = this.currentPromptSizeEstimated ? ' (estimated)' : '';
            console.log(
                `Final Context Size: ${this.currentPromptSize.toLocaleString()}${estimated}`
            );
        }
        console.log('========================');
    }

    /**
     * Reset all statistics
     */
    reset(): void {
        this.apiRequests = 0;
        this.apiSuccess = 0;
        this.apiErrors = 0;
        this.apiTimeSpent = 0;
        this.toolCalls = 0;
        this.toolErrors = 0;
        this.toolTimeSpent = 0;
        this.messagesSent = 0;
        this.tokensProcessed = 0;
        this.compactions = 0;
        this.promptTokens = 0;
        this.completionTokens = 0;
        this.currentPromptSize = 0;
        this.currentPromptSizeEstimated = false;
        this.lastUserPrompt = '';
        this.usageInfos = [];
    }
}
