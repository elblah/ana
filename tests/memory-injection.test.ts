/**
 * Memory Injection Tests
 * Tests for message history injection logic
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { MessageHistory } from '../src/core/message-history';
import { Message, ToolResultData } from '../src/core/types/message-types';
import { Stats } from '../src/core/stats';

describe('Memory Injection', () => {
    let messageHistory: MessageHistory;
    let stats: Stats;

    beforeEach(() => {
        stats = new Stats();
        messageHistory = new MessageHistory(stats);
    });

    describe('Option 1: Inject after tool response (role=tool)', () => {
        it('should inject user message after tool response when found first', () => {
            // Setup: system -> user -> assistant -> tool
            messageHistory.addSystemMessage('System message');
            messageHistory.addUserMessage('User message 1');
            messageHistory.addAssistantMessage({ content: 'Assistant response' });
            messageHistory.addToolResults([{ tool_call_id: 'tool_123', content: 'Tool result' }]);

            // Inject memory
            messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected memory');

            // Verify injection position
            const messages = messageHistory.getMessages();
            expect(messages).toHaveLength(5);
            expect(messages[3].role).toBe('tool');
            expect(messages[3].content).toBe('Tool result');
            expect(messages[4].role).toBe('user');
            expect(messages[4].content).toBe('Injected memory');
        });

        it('should inject after tool response even if other messages exist before', () => {
            // Setup: system -> user -> assistant -> tool -> user (this should be ignored)
            messageHistory.addSystemMessage('System');
            messageHistory.addUserMessage('User 1');
            messageHistory.addAssistantMessage({ content: 'Assistant 1' });
            messageHistory.addToolResults([{ tool_call_id: 'tool_1', content: 'Tool result 1' }]);
            messageHistory.addUserMessage('User 2 (should not be injection target)');

            // Inject memory
            messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected');

            // Verify injection after tool, not after user
            const messages = messageHistory.getMessages();
            expect(messages).toHaveLength(6);
            expect(messages[3].role).toBe('tool');
            expect(messages[4].role).toBe('user');
            expect(messages[4].content).toBe('Injected');
            expect(messages[5].role).toBe('user');
            expect(messages[5].content).toBe('User 2 (should not be injection target)');
        });
    });

    describe('Option 2: Inject after assistant message with no tool calls', () => {
        it('should inject user message after assistant with no tool calls', () => {
            // Setup: system -> user -> assistant (no tool calls)
            messageHistory.addSystemMessage('System');
            messageHistory.addUserMessage('User message');
            messageHistory.addAssistantMessage({ content: 'Assistant response without tools' });

            // Inject memory
            messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected memory');

            // Verify injection position
            const messages = messageHistory.getMessages();
            expect(messages).toHaveLength(4);
            expect(messages[2].role).toBe('assistant');
            expect(messages[2].content).toBe('Assistant response without tools');
            expect(messages[3].role).toBe('user');
            expect(messages[3].content).toBe('Injected memory');
        });

        it('should not inject after assistant with tool calls', () => {
            // Setup: system -> user -> assistant (with tool calls)
            const toolCall = {
                id: 'tool_123',
                type: 'function' as const,
                function: {
                    name: 'test_function',
                    arguments: '{"arg": "value"}'
                }
            };

            messageHistory.addSystemMessage('System');
            messageHistory.addUserMessage('User message');
            messageHistory.addAssistantMessage({ 
                content: 'Assistant response with tools',
                tool_calls: [toolCall]
            });

            // Inject memory
            messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected memory');

            // Should inject after user message instead, not after assistant with tools
            const messages = messageHistory.getMessages();
            expect(messages).toHaveLength(4);
            expect(messages[1].role).toBe('user');
            expect(messages[2].role).toBe('user');
            expect(messages[2].content).toBe('Injected memory');
        });
    });

    describe('Option 3: Inject after user message', () => {
        it('should inject user message after existing user message', () => {
            // Setup: system -> user
            messageHistory.addSystemMessage('System message');
            messageHistory.addUserMessage('User message 1');

            // Inject memory
            messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected memory');

            // Verify injection position
            const messages = messageHistory.getMessages();
            expect(messages).toHaveLength(3);
            expect(messages[1].role).toBe('user');
            expect(messages[1].content).toBe('User message 1');
            expect(messages[2].role).toBe('user');
            expect(messages[2].content).toBe('Injected memory');
        });

        it('should inject after user message when only system and user exist', () => {
            // Setup: system -> user
            messageHistory.addSystemMessage('System');
            messageHistory.addUserMessage('User message');

            // Inject memory
            messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected');

            // Verify injection
            const messages = messageHistory.getMessages();
            expect(messages).toHaveLength(3);
            expect(messages[1].role).toBe('user');
            expect(messages[2].role).toBe('user');
            expect(messages[2].content).toBe('Injected');
        });
    });

    describe('Priority and Order Tests', () => {
        it('should prioritize tool response over assistant without tools', () => {
            // Setup: system -> user -> assistant (no tools) -> tool
            messageHistory.addSystemMessage('System');
            messageHistory.addUserMessage('User');
            messageHistory.addAssistantMessage({ content: 'Assistant no tools' });
            messageHistory.addToolResults([{ tool_call_id: 'tool_1', content: 'Tool result' }]);

            // Inject memory
            messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected');

            // Should inject after tool, not after assistant
            const messages = messageHistory.getMessages();
            expect(messages[3].role).toBe('tool');
            expect(messages[4].role).toBe('user');
            expect(messages[4].content).toBe('Injected');
        });

        it('should prioritize assistant without tools over user', () => {
            // Setup: system -> user -> assistant (no tools)
            messageHistory.addSystemMessage('System');
            messageHistory.addUserMessage('User');
            messageHistory.addAssistantMessage({ content: 'Assistant no tools' });

            // Inject memory
            messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected');

            // Should inject after assistant, not after user
            const messages = messageHistory.getMessages();
            expect(messages[2].role).toBe('assistant');
            expect(messages[3].role).toBe('user');
            expect(messages[3].content).toBe('Injected');
        });
    });

    describe('Edge Cases', () => {
        it('should append to end when only system message exists', () => {
            messageHistory.addSystemMessage('System only');

            messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected');

            const messages = messageHistory.getMessages();
            expect(messages).toHaveLength(2);
            expect(messages[1].role).toBe('user');
            expect(messages[1].content).toBe('Injected');
        });

        it('should append to end when no messages exist', () => {
            messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected');

            const messages = messageHistory.getMessages();
            expect(messages).toHaveLength(1);
            expect(messages[0].role).toBe('user');
            expect(messages[0].content).toBe('Injected');
        });

        it('should work with complex conversation flow', () => {
            const toolCall = {
                id: 'tool_123',
                type: 'function' as const,
                function: {
                    name: 'test_function',
                    arguments: '{"arg": "value"}'
                }
            };

            // Complex conversation
            messageHistory.addSystemMessage('System');
            messageHistory.addUserMessage('User 1');
            messageHistory.addAssistantMessage({ content: 'Assistant 1', tool_calls: [toolCall] });
            messageHistory.addToolResults([{ tool_call_id: 'tool_123', content: 'Tool result' }]);
            messageHistory.addUserMessage('User 2');
            messageHistory.addAssistantMessage({ content: 'Assistant 2 (no tools)' });

            // Inject memory - should go after assistant with no tools
            messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected');

            const messages = messageHistory.getMessages();
            expect(messages).toHaveLength(7);
            // Find injected message
            const injectedIndex = messages.findIndex(m => m.content === 'Injected');
            expect(injectedIndex).toBe(4); // After tool result at index 3 (priority 1)
            expect(messages[injectedIndex - 1].role).toBe('tool');
            expect(messages[injectedIndex - 1].content).toBe('Tool result');
        });
    });

    describe('Real-world Scenarios', () => {
        it('should handle typical tool calling conversation', () => {
            const toolCall = {
                id: 'call_123',
                type: 'function' as const,
                function: {
                    name: 'read_file',
                    arguments: '{"path": "test.txt"}'
                }
            };

            // Typical tool usage flow
            messageHistory.addSystemMessage('You are a helpful assistant.');
            messageHistory.addUserMessage('Read the file test.txt');
            messageHistory.addAssistantMessage({ 
                content: 'I\'ll read the file for you.',
                tool_calls: [toolCall]
            });
            messageHistory.addToolResults([{ tool_call_id: 'call_123', content: 'File content: Hello world!' }]);

            // Inject memory
            messageHistory.insertUserMessageAfterLastAppropriatePosition('Remember: user prefers concise answers');

            const messages = messageHistory.getMessages();
            expect(messages).toHaveLength(5);
            // Should inject after tool result
            expect(messages[3].role).toBe('tool');
            expect(messages[4].role).toBe('user');
            expect(messages[4].content).toBe('Remember: user prefers concise answers');
        });

        it('should handle multiple assistant messages without tools', () => {
            messageHistory.addSystemMessage('System');
            messageHistory.addUserMessage('Help me');
            messageHistory.addAssistantMessage({ content: 'I\'ll help you' });
            messageHistory.addAssistantMessage({ content: 'What do you need help with?' });

            // Inject memory
            messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected memory');

            const messages = messageHistory.getMessages();
            expect(messages).toHaveLength(5);
            // Should inject after last assistant message (no tools)
            const injectedIndex = messages.findIndex(m => m.content === 'Injected memory');
            expect(injectedIndex).toBe(4);
            expect(messages[injectedIndex - 1].role).toBe('assistant');
            expect(messages[injectedIndex - 1].content).toBe('What do you need help with?');
        });
    });
});