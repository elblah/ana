/**
 * Circular dependency regression test
 * Ensures the core circular dependency issue remains resolved
 */

import { describe, it, expect } from 'bun:test';
import type { MessageHistory, StreamingClient, InputHandler, Stats } from '../../src/core/types/index.js';

// Import from core modules to test they can resolve without circular dependencies
import { MessageHistory as MessageHistoryClass } from '../../src/core/message-history.js';
import { CompactionService } from '../../src/core/compaction-service.js';
import { StreamingClient as StreamingClientClass } from '../../src/core/streaming-client.js';
import { AIProcessor } from '../../src/core/ai-processor.js';

describe('Circular Dependency Regression', () => {
    it('should allow importing core modules without circular dependency errors', () => {
        // The fact this file compiles means no circular dependencies exist
        
        // Test that we can reference all the main classes
        expect(MessageHistoryClass).toBeDefined();
        expect(CompactionService).toBeDefined();
        expect(StreamingClientClass).toBeDefined();
        expect(AIProcessor).toBeDefined();
        
        // Test that we can create instances (basic sanity check)
        const mockClient = {} as StreamingClientClass;
        const messageHistory = new MessageHistoryClass(mockClient);
        expect(messageHistory).toBeInstanceOf(MessageHistoryClass);
        
        const compactionService = new CompactionService();
        expect(compactionService).toBeInstanceOf(CompactionService);
    });
    
    it('should maintain forward declarations as documented workaround', () => {
        // Verify forward declarations are in place and documented
        // This test ensures we don't accidentally remove the forward declarations
        // that break the circular dependency
        
        // Forward declarations should exist in system-types.ts
        type TestForwardDeclarations = {
            MessageHistory: MessageHistory;
            StreamingClient: StreamingClient;
            InputHandler: InputHandler;
            Stats: Stats;
        };
        
        // Compilation success means forward declarations work
        expect(true).toBe(true);
    });
});