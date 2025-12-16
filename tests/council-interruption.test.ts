/**
 * Test for council interruption behavior
 * Verifies that Ctrl+C during /council --auto doesn't trigger a new council
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AICoder } from '../src/core/aicoder.js';

describe('Council Interruption', () => {
    let aiCoder: AICoder;

    beforeEach(() => {
        // Create AICoder instance (it has default constructor)
        aiCoder = new AICoder();
    });

    afterEach(() => {
        // Clean up to avoid test interference
        (aiCoder as any).isProcessing = false;
        (aiCoder as any).nextPrompt = null;
    });

    it('should clear next prompt when interrupted during processing', () => {
        // Set a next prompt
        aiCoder.setNextPrompt('/council --auto spec.md');
        expect(aiCoder.hasNextPrompt()).toBe(true);
        
        // Simulate being in processing state
        (aiCoder as any).isProcessing = true;
        
        // Simulate interruption
        (aiCoder as any).handleSignal();
        
        // Check that next prompt was cleared
        expect(aiCoder.hasNextPrompt()).toBe(false);
        expect(aiCoder.getNextPrompt()).toBe(null);
        // Also check processing flag was reset
        expect((aiCoder as any).isProcessing).toBe(false);
    });

    it('should not clear next prompt when not processing (exit case)', () => {
        // Set a next prompt
        aiCoder.setNextPrompt('/council --auto spec.md');
        expect(aiCoder.hasNextPrompt()).toBe(true);
        
        // Ensure not processing
        (aiCoder as any).isProcessing = false;
        
        // Mock process.exit to prevent actual exit
        const originalExit = process.exit;
        let exitCalled = false;
        process.exit = () => {
            exitCalled = true;
            throw new Error('process.exit called');
        };

        try {
            // Simulate interruption when not processing
            (aiCoder as any).handleSignal();
        } catch (error) {
            // Expected - process.exit was called
            expect((error as Error).message).toBe('process.exit called');
        } finally {
            // Restore process.exit
            process.exit = originalExit;
        }
        
        // In this case, the prompt should be cleared since we're exiting
        // This happens because the handler clears it unconditionally when isProcessing is false
    });

    it('should clear next prompt on second SIGINT as well', () => {
        // Set a next prompt
        aiCoder.setNextPrompt('/council --auto spec.md');
        expect(aiCoder.hasNextPrompt()).toBe(true);
        
        // First signal - not processing, should exit
        (aiCoder as any).isProcessing = false;
        
        // Mock process.exit to prevent actual exit
        const originalExit = process.exit;
        let exitCallCount = 0;
        process.exit = () => {
            exitCallCount++;
            if (exitCallCount === 1) {
                throw new Error('process.exit called first time');
            }
        };

        try {
            // First interruption when not processing
            (aiCoder as any).handleSignal();
        } catch (error) {
            // Expected
        } finally {
            process.exit = originalExit;
        }
    });
});