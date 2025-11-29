/**
 * Essential app integration test
 * Tests that types work correctly with the real application
 */

import { describe, it, expect } from 'bun:test';
import type { Message, ToolDefinition } from '../../src/core/types/index.js';
import type { Message as BarreledMessage } from '../../src/core/types/index.js';
import type { Message as DirectMessage } from '../../src/core/types/message-types.js';

// Import real application modules
import { ToolManager } from '../../src/core/tool-manager.js';
import { Stats } from '../../src/core/stats.js';

describe('App Integration', () => {
    it('should integrate types with real application modules', () => {
        // Test that our types work with actual application classes
        
        const stats = new Stats();
        expect(stats).toBeInstanceOf(Stats);
        
        // Test that we can create a tool that uses our type definitions
        const testTool: ToolDefinition = {
            name: 'test_integration_tool',
            description: 'Test tool for type integration',
            parameters: {
                type: 'object',
                properties: {
                    message: { type: 'string' }
                },
                required: ['message']
            },
            execute: async (args) => {
                return {
                    content: `Processed: ${args.message}`,
                    friendly_message: 'Integration test passed'
                };
            }
        };
        
        expect(testTool.name).toBe('test_integration_tool');
        expect(typeof testTool.execute).toBe('function');
    });
    
    it('should maintain type consistency across the application', () => {
        // Test that types from barrel export match directly imported types
        
        // These should be compatible
        const directMessage: DirectMessage = { role: 'user', content: 'test' };
        const barrelMessage: BarreledMessage = directMessage;
        
        expect(barrelMessage.role).toBe('user');
        expect(barrelMessage.content).toBe('test');
    });
});