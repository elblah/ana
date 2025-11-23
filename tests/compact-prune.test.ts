import { describe, it, expect, beforeEach } from 'bun:test';
import {
    MessageHistory,
    PRUNED_TOOL_MESSAGE,
    PRUNE_PROTECTION_THRESHOLD,
} from '../src/core/message-history.js';
import { Stats } from '../src/core/stats.js';

describe('Compact Prune Commands', () => {
    let messageHistory: MessageHistory;
    let stats: Stats;

    beforeEach(() => {
        stats = new Stats();
        messageHistory = new MessageHistory(stats);

        // Add some test data
        messageHistory.addSystemMessage('System prompt');

        // Add user message with tool call
        messageHistory.addUserMessage('List the directory');

        // Add assistant message with tool call
        messageHistory.addAssistantMessage({
            content: 'I will list the directory',
            tool_calls: [
                {
                    id: 'tool1',
                    type: 'function',
                    function: {
                        name: 'list_directory',
                        arguments: '{"path": "/test"}',
                    },
                },
            ],
        });

        // Add tool results - generate large strings > protection threshold
        const largeContent1 = 'A'.repeat(PRUNE_PROTECTION_THRESHOLD + 50);
        const largeContent2 = 'B'.repeat(PRUNE_PROTECTION_THRESHOLD + 150);

        messageHistory.addToolResults([
            {
                tool_call_id: 'tool1',
                content: largeContent1,
            },
        ]);

        // Add another tool result
        messageHistory.addToolResults([
            {
                tool_call_id: 'tool2',
                content: largeContent2,
            },
        ]);
    });

    it('should count tool results correctly', () => {
        const stats = messageHistory.getToolCallStats();
        expect(stats.count).toBe(2);
        expect(stats.bytes).toBeGreaterThan(0);
        expect(stats.tokens).toBeGreaterThan(0);
    });

    it('should prune all tool results', () => {
        const beforeStats = messageHistory.getToolCallStats();
        expect(beforeStats.count).toBe(2);

        const prunedCount = messageHistory.pruneAllToolResults();
        expect(prunedCount).toBe(2); // Both should be pruned (they're larger than prune message)

        const afterStats = messageHistory.getToolCallStats();
        expect(afterStats.count).toBe(2); // Still same count, but content changed
    });

    it('should prune oldest tool results', () => {
        const beforeStats = messageHistory.getToolCallStats();
        expect(beforeStats.count).toBe(2);

        const prunedCount = messageHistory.pruneOldestToolResults(1);
        expect(prunedCount).toBe(1); // Only one should be pruned

        const toolMessages = messageHistory.getToolResultMessages();
        // First tool result should be pruned
        expect(toolMessages[0].content).toBe(PRUNED_TOOL_MESSAGE);
        // Second should remain unchanged
        expect(toolMessages[1].content).toBe('B'.repeat(406)); // 256 + 150
    });

    it('should handle pruning more than available', () => {
        const prunedCount = messageHistory.pruneOldestToolResults(10); // More than available
        expect(prunedCount).toBe(2); // Only 2 available to prune

        const toolMessages = messageHistory.getToolResultMessages();
        for (const msg of toolMessages) {
            expect(msg.content).toBe(PRUNED_TOOL_MESSAGE);
        }
    });

    it('should not prune if content is smaller than prune message', () => {
        // Add a small tool result
        messageHistory.addToolResults([
            {
                tool_call_id: 'tool3',
                content: 'short', // Smaller than prune message
            },
        ]);

        const beforeStats = messageHistory.getToolCallStats();
        expect(beforeStats.count).toBe(3);

        // Try to prune the small one
        const prunedCount = messageHistory.pruneOldestToolResults(1);
        expect(prunedCount).toBe(1); // Should prune the first large one, not the small one

        const toolMessages = messageHistory.getToolResultMessages();
        // First should be pruned (it was large)
        expect(toolMessages[0].content).toBe(PRUNED_TOOL_MESSAGE);
        // The small one should remain unchanged
        expect(toolMessages[2].content).toBe('short');
    });

    it('should handle no tool results gracefully', () => {
        // Create empty message history
        const emptyHistory = new MessageHistory(new Stats());
        emptyHistory.addSystemMessage('System prompt');

        const stats = emptyHistory.getToolCallStats();
        expect(stats.count).toBe(0);
        expect(stats.tokens).toBe(0);
        expect(stats.bytes).toBe(0);

        // Should not error when pruning empty history
        const prunedAll = emptyHistory.pruneAllToolResults();
        const prunedSome = emptyHistory.pruneOldestToolResults(5);
        expect(prunedAll).toBe(0);
        expect(prunedSome).toBe(0);
    });

    it('should prune tool results by percentage with protection threshold', () => {
        // Reset with test data
        messageHistory = new MessageHistory(stats);

        // Add large tool results (>protection threshold) and small ones (<=protection threshold)
        messageHistory.addToolResults([
            {
                tool_call_id: 'large1',
                content: 'A'.repeat(PRUNE_PROTECTION_THRESHOLD + 50), // Large, should be pruned
            },
        ]);
        messageHistory.addToolResults([
            {
                tool_call_id: 'small1',
                content: 'B'.repeat(PRUNE_PROTECTION_THRESHOLD - 20), // Small, should be protected
            },
        ]);
        messageHistory.addToolResults([
            {
                tool_call_id: 'large2',
                content: 'C'.repeat(PRUNE_PROTECTION_THRESHOLD + 100), // Large, should be pruned
            },
        ]);
        messageHistory.addToolResults([
            {
                tool_call_id: 'small2',
                content: 'D'.repeat(PRUNE_PROTECTION_THRESHOLD - 100), // Small, should be protected
            },
        ]);

        const result = messageHistory.pruneToolResultsByPercentage(50); // 50% of large ones

        expect(result.prunedCount).toBe(1); // 50% of 2 large = 1
        expect(result.protectedCount).toBe(2); // 2 small ones protected
        expect(result.savedBytes).toBeGreaterThan(0); // Should save some bytes

        // Verify oldest large one was pruned
        const toolMessages = messageHistory.getToolResultMessages();
        expect(toolMessages[0].content).toBe(PRUNED_TOOL_MESSAGE); // large1 pruned
        expect(toolMessages[1].content).toBe('B'.repeat(PRUNE_PROTECTION_THRESHOLD - 20)); // small1 protected
        expect(toolMessages[2].content).toBe('C'.repeat(PRUNE_PROTECTION_THRESHOLD + 100)); // large2 not pruned (only 50%)
        expect(toolMessages[3].content).toBe('D'.repeat(PRUNE_PROTECTION_THRESHOLD - 100)); // small2 protected
    });

    it('should handle consecutive pruning correctly', () => {
        // Reset with test data
        messageHistory = new MessageHistory(stats);

        // Add multiple large tool results that can be pruned multiple times
        for (let i = 0; i < 8; i++) {
            messageHistory.addToolResults([
                {
                    tool_call_id: `large${i}`,
                    content: 'X'.repeat(PRUNE_PROTECTION_THRESHOLD + 100 + i * 50), // Ensure all >256 bytes
                },
            ]);
        }

        // First prune - should prune 50% of large results (4 out of 8)
        const firstResult = messageHistory.pruneToolResultsByPercentage(50);
        expect(firstResult.prunedCount).toBe(4); // 50% of 8 = 4
        expect(firstResult.savedBytes).toBeGreaterThan(0);

        // Second prune - should prune 50% of remaining large results (2 out of 4)
        const secondResult = messageHistory.pruneToolResultsByPercentage(50);
        expect(secondResult.prunedCount).toBe(2); // 50% of remaining 4 = 2
        expect(secondResult.savedBytes).toBeGreaterThan(0);

        // Third prune - should prune 50% of remaining large results (1 out of 2)
        const thirdResult = messageHistory.pruneToolResultsByPercentage(50);
        expect(thirdResult.prunedCount).toBe(1); // 50% of remaining 2 = 1
        expect(thirdResult.savedBytes).toBeGreaterThan(0);

        // Fourth prune - should still have 1 large result left to prune
        const fourthResult = messageHistory.pruneToolResultsByPercentage(50);
        expect(fourthResult.prunedCount).toBe(1); // 50% of 1 = 0.5 rounded down to 0, but should be 1 since Math.floor may give 0
        expect(fourthResult.savedBytes).toBeGreaterThan(0);

        // Fifth prune - should finally have no large results left
        const fifthResult = messageHistory.pruneToolResultsByPercentage(50);
        expect(fifthResult.prunedCount).toBe(0); // No large results left
        expect(fifthResult.savedBytes).toBe(0);
        expect(fifthResult.protectedCount).toBeGreaterThan(0); // Only pruned (small) results remain
    });
});
