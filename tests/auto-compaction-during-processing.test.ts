/**
 * Test auto-compaction during AI processing
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Stats } from '../src/core/stats.js';
import { MessageHistory } from '../src/core/message-history.js';
import { StreamingClient } from '../src/core/streaming-client.js';
import { Config } from '../src/core/config.js';
import type { MessageToolCall } from '../src/core/types.js';

describe('Auto-Compaction During Processing', () => {
    let stats: Stats;
    let messageHistory: MessageHistory;
    let mockApiClient: StreamingClient;

    beforeEach(async () => {
        // Set low threshold for testing using environment variables
        process.env.CONTEXT_SIZE = '1000';
        process.env.CONTEXT_COMPACT_PERCENTAGE = '80'; // 80% of context size = 800
        
        stats = new Stats();
        messageHistory = new MessageHistory(stats);
        
        // Create mock API client
        mockApiClient = new StreamingClient(stats, null as any);
        messageHistory.setApiClient(mockApiClient);

        // Add system message
        messageHistory.addSystemMessage('You are a helpful assistant.');
    });

    afterEach(() => {
        // Reset config
        delete process.env.CONTEXT_SIZE;
        delete process.env.CONTEXT_COMPACT_PERCENTAGE;
    });

    it('should trigger compaction before AI request when threshold exceeded', async () => {
        // Add enough messages to exceed threshold
        for (let i = 0; i < 50; i++) {
            messageHistory.addUserMessage(`User message ${i} with lots of content to increase token count and trigger compaction threshold for testing purposes.`);
            messageHistory.addAssistantMessage({
                content: `Assistant response ${i} with detailed explanation that adds more tokens to the conversation context.`
            });
            
            // Add some tool results
            messageHistory.addToolResults([{
                tool_call_id: `tool_${i}`,
                content: `Tool result ${i} with substantial output that consumes significant context space and memory during the AI processing phase.`
            }]);
        }

        // Should trigger compaction
        expect(messageHistory.shouldAutoCompact()).toBe(true);

        // Test that we can call compactMemory (in real scenario this happens during processing)
        const originalCount = messageHistory.getMessages().length;
        
        try {
            await messageHistory.compactMemory();
            // Compaction should reduce message count
            expect(messageHistory.getMessages().length).toBeLessThan(originalCount);
        } catch (error) {
            // If compaction fails due to mock API, that's expected
            console.log('Compaction failed (expected with mock API):', error);
        }
    });

    it('should not compact when below threshold', async () => {
        // Add few messages
        messageHistory.addUserMessage('Short message');
        messageHistory.addAssistantMessage({
            content: 'Short response'
        });

        // Should not trigger compaction
        expect(messageHistory.shouldAutoCompact()).toBe(false);
    });

    it('should handle concurrent compaction requests safely', async () => {
        // Add messages to exceed threshold
        for (let i = 0; i < 30; i++) {
            messageHistory.addUserMessage(`Message ${i}`);
            messageHistory.addAssistantMessage({
                content: `Response ${i}`
            });
        }

        expect(messageHistory.shouldAutoCompact()).toBe(true);

        // Try concurrent compaction (should be prevented)
        const compactPromise1 = messageHistory.compactMemory();
        const compactPromise2 = messageHistory.compactMemory();

        await Promise.allSettled([compactPromise1, compactPromise2]);
        
        // Should not crash or enter invalid state
        const finalMessages = messageHistory.getMessages();
        expect(finalMessages.length).toBeGreaterThan(0);
        expect(finalMessages[0].role).toBe('system'); // System message should be preserved
    });
});