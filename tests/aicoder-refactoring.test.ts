/**
 * Test cases for AICoder refactoring - ensure functionality preserved
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AICoder } from '../src/core/aicoder.js';
import { Config } from '../src/core/config.js';

// Mock dependencies
const mockInputHandler = {
    getUserInput: () => Promise.resolve('test input'),
    prompt: () => Promise.resolve('y'),
    addToHistory: () => {},
    close: () => {},
    setStatsContext: () => {},
    setMessageHistory: () => {},
};

const mockStreamingClient = {
    streamRequest: async function* () {
        yield { choices: [{ delta: { content: 'test' } }] };
    },
    updateTokenStats: () => {},
    processWithColorization: (text: string) => text,
    resetColorizer: () => {},
};

const mockMessageHistory = {
    addSystemMessage: () => {},
    addUserMessage: () => {},
    addAssistantMessage: () => {},
    addToolResults: () => {},
    getMessages: () => [],
    shouldAutoCompact: () => false,
    compactMemory: () => Promise.resolve(),
    setApiClient: () => {},
};

const mockToolManager = {
    getToolDefinition: () => ({ auto_approved: false }),
    executeToolCall: () => ({ content: 'result' }),
    formatToolArguments: () => 'formatted args',
    generatePreview: () => null,
    originalWriteFile: () => Promise.resolve(),
    originalEditFile: () => Promise.resolve(),
};

describe('AICoder Refactoring Tests', () => {
    let aicoder: AICoder;

    beforeEach(() => {
        // Override config for testing using environment variables
        process.env.YOLO_MODE = 'true';
        process.env.DISABLE_PLUGINS = 'true';
    });

    afterEach(() => {
        // Reset config
        delete process.env.YOLO_MODE;
        delete process.env.DISABLE_PLUGINS;
    });

    it('should maintain same public API', () => {
        aicoder = new AICoder();
        
        // Check that main public methods exist
        expect(typeof aicoder.run).toBe('function');
        expect(typeof aicoder.initialize).toBe('function');
        expect(typeof aicoder.registerNotifyHooks).toBe('function');
    });

    it('should initialize plugins correctly', () => {
        aicoder = new AICoder();
        // Should not throw during initialization
        expect(() => aicoder['initializePlugins']()).not.toThrow();
    });

    it('should handle system prompt building', async () => {
        aicoder = new AICoder();
        const systemPrompt = await aicoder['buildSystemPrompt']();
        expect(typeof systemPrompt).toBe('string');
        expect(systemPrompt.length).toBeGreaterThan(0);
    });

    it('should maintain backward compatibility with processWithAI structure', () => {
        aicoder = new AICoder();
        
        // Check that the main processing method still exists
        expect(typeof aicoder['processWithAI']).toBe('function');
        
        // Check that all the helper methods exist
        expect(typeof aicoder['prepareForProcessing']).toBe('function');
        expect(typeof aicoder['streamResponse']).toBe('function');
        expect(typeof aicoder['validateAndProcessToolCalls']).toBe('function');
        expect(typeof aicoder['handlePostProcessing']).toBe('function');
        expect(typeof aicoder['handleProcessingError']).toBe('function');
    });

    it('should have refactored executeToolCalls methods', () => {
        aicoder = new AICoder();
        
        // Check that refactored methods exist
        expect(typeof aicoder['executeToolCalls']).toBe('function');
        expect(typeof aicoder['executeSingleToolCall']).toBe('function');
        expect(typeof aicoder['handleToolNotFound']).toBe('function');
        expect(typeof aicoder['generateToolPreview']).toBe('function');
        expect(typeof aicoder['displayToolInfo']).toBe('function');
        expect(typeof aicoder['handleToolApproval']).toBe('function');
        expect(typeof aicoder['executeApprovedTool']).toBe('function');
        expect(typeof aicoder['addToolResult']).toBe('function');
        expect(typeof aicoder['displayToolResult']).toBe('function');
    });

    it('should handle tool not found case', () => {
        aicoder = new AICoder();
        
        (aicoder as any).toolManager = {
            getToolDefinition: () => null,
        };
        (aicoder as any).messageHistory = mockMessageHistory;

        // Should not throw
        expect(() => {
            aicoder['handleToolNotFound']('nonexistent_tool', 'test_id');
        }).not.toThrow();
    });

    it('should handle tool result addition and display', () => {
        aicoder = new AICoder();
        
        (aicoder as any).messageHistory = mockMessageHistory;
        
        // Should not throw
        expect(() => {
            aicoder['addToolResult']('test_id', 'test content');
        }).not.toThrow();

        expect(() => {
            aicoder['displayToolResult'](
                { content: 'test', friendly: 'friendly test' },
                { hide_results: false }
            );
        }).not.toThrow();
    });

    it('should handle tool approval with auto-approved tools', async () => {
        aicoder = new AICoder();
        
        const toolCall = {
            id: 'test1',
            type: 'function',
            function: {
                name: 'test_tool',
                arguments: '{"path": "/test"}'
            }
        };

        (aicoder as any).inputHandler = mockInputHandler;
        (aicoder as any).toolManager = mockToolManager;

        // Test with auto-approved tool
        const autoApprovedTool = { auto_approved: true };
        const result = await aicoder['handleToolApproval'](toolCall, autoApprovedTool);
        expect(result).toBe(false);
    });

    it('should handle tool approval with yolo mode', async () => {
        aicoder = new AICoder();
        
        const toolCall = {
            id: 'test1',
            type: 'function',
            function: {
                name: 'test_tool',
                arguments: '{"path": "/test"}'
            }
        };

        (aicoder as any).inputHandler = mockInputHandler;
        (aicoder as any).toolManager = mockToolManager;

        // Test with yolo mode
        process.env.YOLO_MODE = 'true';
        const regularTool = { auto_approved: false };
        const yoloResult = await aicoder['handleToolApproval'](toolCall, regularTool);
        expect(yoloResult).toBe(false);
        delete process.env.YOLO_MODE;
    });

    it('should maintain same method signatures and behavior', () => {
        aicoder = new AICoder();
        
        // Check that methods have expected signatures by calling them with minimal mocks
        const processWithAI = aicoder['processWithAI'];
        const executeToolCalls = aicoder['executeToolCalls'];
        const executeSingleToolCall = aicoder['executeSingleToolCall'];
        
        expect(typeof processWithAI).toBe('function');
        expect(typeof executeToolCalls).toBe('function');
        expect(typeof executeSingleToolCall).toBe('function');
        
        // Methods should be async
        expect(processWithAI.constructor.name).toBe('AsyncFunction');
        expect(executeToolCalls.constructor.name).toBe('AsyncFunction');
        expect(executeSingleToolCall.constructor.name).toBe('AsyncFunction');
    });
});