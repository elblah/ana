/**
 * Generic AI Message Processor
 * Unified way to process messages with AI for different purposes
 */

import type { Message } from './message-history.js';
import type { StreamingClient } from './streaming-client.js';
import { Config } from './config.js';
import { LogUtils } from '../utils/log-utils.js';

/**
 * Configuration for AI processing
 */
export interface AIProcessorConfig {
    systemPrompt?: string;
    maxRetries?: number;
    timeout?: number;
}

/**
 * Generic AI message processor
 * Provides unified interface for different AI-powered features:
 * - Compaction: Summarize conversations
 * - Council: Generate expert opinions  
 * - Code Review: Analyze code for issues
 * - Documentation: Generate docs from implementations
 */
export class AIProcessor {
    constructor(
        private streamingClient: StreamingClient,
        private config: AIProcessorConfig = {}
    ) {}

    /**
     * Process messages with a custom prompt
     * This is the core method that all features use
     */
    async processMessages(
        messages: Message[],
        prompt: string,
        additionalConfig?: AIProcessorConfig
    ): Promise<string> {
        const finalConfig = { ...this.config, ...additionalConfig };
        
        // Build message list with optional system prompt
        const allMessages: Message[] = [];
        
        if (finalConfig.systemPrompt) {
            allMessages.push({ role: 'system', content: finalConfig.systemPrompt });
        }
        
        // Add existing messages
        allMessages.push(...messages);
        
        // Add the processing prompt
        allMessages.push({ role: 'user', content: prompt });

        // Process with retry logic - using streaming client's built-in retry
        let fullResponse = '';
        
        try {
            const response = this.streamingClient.streamRequest(
                allMessages,
                false, // Non-streaming for complete response
                true  // Throw on error
            );

            for await (const chunk of response) {
                const content = chunk.choices?.[0]?.delta?.content;
                if (content) {
                    fullResponse += content;
                }
            }

            return fullResponse.trim();
        } catch (error) {
            LogUtils.warn(`AI Processor failed: ${error}`);
            throw new Error(`AI Processor failed: ${error}`);
        }
    }

    /**
     * Convenience method for simple processing without system prompt
     */
    async process(
        messages: Message[],
        prompt: string
    ): Promise<string> {
        return this.processMessages(messages, prompt);
    }
}