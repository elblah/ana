/**
 * Basic domain tests for all type domains
 * Essential validation that core type structures work
 */

import { describe, it, expect } from 'bun:test';
import type { Message, AssistantMessage, ToolResultData } from '../../src/core/types/message-types.js';
import type { ApiUsage, ApiRequestData, StreamChunk } from '../../src/core/types/api-types.js';
import type { ToolDefinition, ToolOutput, CommandResult } from '../../src/core/types/tool-types.js';
import type { Plugin, PluginContext, CouncilMember } from '../../src/core/types/system-types.js';

describe('Message Domain Tests', () => {
    it('should handle basic message structures', () => {
        const message: Message = {
            role: 'user',
            content: 'test message'
        };
        
        expect(message.role).toBe('user');
        expect(message.content).toBe('test message');
    });
    
    it('should handle assistant messages with tool calls', () => {
        const assistant: AssistantMessage = {
            role: 'assistant',
            content: 'I will help you',
            tool_calls: [{
                id: 'call_123',
                type: 'function',
                function: { name: 'test_tool', arguments: '{}' }
            }]
        };
        
        expect(assistant.tool_calls).toHaveLength(1);
        expect(assistant.tool_calls![0].id).toBe('call_123');
    });
});

describe('API Domain Tests', () => {
    it('should handle API usage tracking', () => {
        const usage: ApiUsage = {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150
        };
        
        expect(usage.prompt_tokens).toBe(100);
        expect(usage.total_tokens).toBe(150);
    });
    
    it('should handle API request structures', () => {
        const request: ApiRequestData = {
            model: 'test-model',
            messages: [{ role: 'user', content: 'test' }],
            stream: true
        };
        
        expect(request.model).toBe('test-model');
        expect(request.stream).toBe(true);
    });
});

describe('Tool Domain Tests', () => {
    it('should handle tool definitions', () => {
        const tool: ToolDefinition = {
            name: 'test_tool',
            description: 'A test tool',
            parameters: { type: 'object', properties: {} },
            execute: async () => ({ content: 'result' })
        };
        
        expect(tool.name).toBe('test_tool');
        expect(typeof tool.execute).toBe('function');
    });
    
    it('should handle tool outputs', () => {
        const output: ToolOutput = {
            content: 'success',
            friendly_message: 'Operation completed'
        };
        
        expect(output.content).toBe('success');
        expect(output.friendly_message).toBe('Operation completed');
    });
});

describe('System Domain Tests', () => {
    it('should handle plugin definitions', () => {
        const plugin: Plugin = {
            name: 'test-plugin',
            version: '1.0.0',
            initialize: async () => {}
        };
        
        expect(plugin.name).toBe('test-plugin');
        expect(typeof plugin.initialize).toBe('function');
    });
    
    it('should handle council member configurations', () => {
        const member: CouncilMember = {
            name: 'Test Member',
            role: 'testing',
            vote: (proposal: string) => ({ approved: true, reason: 'Test approved' })
        };
        
        expect(member.name).toBe('Test Member');
        expect(typeof member.vote).toBe('function');
    });
});