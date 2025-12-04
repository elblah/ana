/**
 * Tests for signal handler functionality
 */

import { describe, it, beforeEach, afterEach, expect } from 'bun:test';
import { AICoder } from '../src/core/aicoder';

describe('Signal Handler', () => {
    let aicoder: AICoder;

    beforeEach(() => {
        aicoder = new AICoder();
    });

    it('should interrupt processing on first SIGINT', () => {
        // Set processing state
        (aicoder as any).isProcessing = true;
        
        // Call signal handler
        (aicoder as any).handleSignal();
        
        // Verify processing was interrupted
        expect((aicoder as any).isProcessing).toBe(false);
    });

    it('should exit on SIGINT when not processing', () => {
        // Ensure not processing
        (aicoder as any).isProcessing = false;
        
        // Mock process.exit to avoid actually exiting during test
        const originalExit = process.exit;
        let exitCalled = false;
        process.exit = (() => { exitCalled = true; }) as any;
        
        try {
            // Call signal handler
            (aicoder as any).handleSignal();
            
            // Verify exit was called
            expect(exitCalled).toBe(true);
        } finally {
            // Restore original exit
            process.exit = originalExit;
        }
    });

    it('should handle multiple rapid signals correctly', () => {
        // Set processing state
        (aicoder as any).isProcessing = true;
        
        // First signal should interrupt
        (aicoder as any).handleSignal();
        expect((aicoder as any).isProcessing).toBe(false);
        
        // Second signal should exit
        const originalExit = process.exit;
        let exitCalled = false;
        process.exit = (() => { exitCalled = true; }) as any;
        
        try {
            (aicoder as any).handleSignal();
            expect(exitCalled).toBe(true);
        } finally {
            process.exit = originalExit;
        }
    });
});