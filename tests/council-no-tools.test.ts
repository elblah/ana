/**
 * Tests to verify council members do not receive tool information
 * This ensures council members command the AI rather than trying to execute tools themselves
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { AIProcessor } from '../src/core/ai-processor.js';
import { StreamingClient } from '../src/core/streaming-client.js';
import { Stats } from '../src/core/stats.js';

describe('Council No Tools Tests', () => {

    let processor: AIProcessor;
    let streamingClient: StreamingClient;
    let stats: Stats;

    beforeEach(() => {
        stats = new Stats();
        streamingClient = new StreamingClient(stats);
        processor = new AIProcessor(streamingClient);
    });

    describe('AIProcessor excludeTools and systemPrompt parameters', () => {
        it('should pass both excludeTools and systemPrompt parameters to streaming client', async () => {
            // Mock the streaming client's streamRequest method
            const mockCalls: any[] = [];
            const originalStreamRequest = streamingClient.streamRequest;
            streamingClient.streamRequest = async function*(...args: any[]) {
                mockCalls.push(args);
                return;
            };

            try {
                // Test with excludeTools: true and systemPrompt
                await processor.processMessages(
                    [{ role: 'user', content: 'test' }],
                    'test prompt',
                    { 
                        excludeTools: true,
                        systemPrompt: 'You are a test assistant.'
                    }
                );

                // Verify streamRequest was called with correct parameters
                expect(mockCalls.length).toBe(1);
                expect(mockCalls[0][3]).toBe(true);  // excludeTools should be true

                // Verify the message structure
                const allMessages = mockCalls[0][0];
                expect(allMessages.length).toBe(3); // system + original user + processing prompt
                expect(allMessages[0]).toEqual({
                    role: 'system',
                    content: 'You are a test assistant.'
                });
                expect(allMessages[1]).toEqual({
                    role: 'user',
                    content: 'test'  // Original message
                });
                expect(allMessages[2]).toEqual({
                    role: 'user',
                    content: 'test prompt'  // Processing prompt
                });

                // Clear calls
                mockCalls.length = 0;

                // Test with excludeTools: false (default) and no systemPrompt
                await processor.processMessages(
                    [{ role: 'user', content: 'test' }],
                    'test prompt'
                );

                // Verify streamRequest was called with excludeTools: undefined and no system prompt
                expect(mockCalls.length).toBe(1);
                expect(mockCalls[0][3]).toBeUndefined();  // excludeTools should be undefined

                // Verify no system message was added
                const messagesNoSystem = mockCalls[0][0];
                expect(messagesNoSystem.length).toBe(2); // original user + new user prompt
                expect(messagesNoSystem[0].role).toBe('user');
                expect(messagesNoSystem[1].role).toBe('user');

            } finally {
                // Restore original method
                streamingClient.streamRequest = originalStreamRequest;
            }
        });
    });

    describe('StreamingClient tool exclusion', () => {
        it('should not add tool definitions when excludeTools is true', () => {
            // Mock the addToolDefinitions method
            let addToolCallsCount = 0;
            const originalAddToolDefinitions = (streamingClient as any).addToolDefinitions;
            (streamingClient as any).addToolDefinitions = () => {
                addToolCallsCount++;
            };

            try {
                // Call prepareRequestData directly with excludeTools: true
                const requestData = (streamingClient as any).prepareRequestData(
                    [{ role: 'user', content: 'test' }],
                    undefined,
                    false,
                    true  // excludeTools: true
                );

                // Verify addToolDefinitions was NOT called
                expect(addToolCallsCount).toBe(0);

                // Verify tools are not in the request data
                expect(requestData.tools).toBeUndefined();
                expect(requestData.tool_choice).toBeUndefined();

            } finally {
                // Restore original method
                (streamingClient as any).addToolDefinitions = originalAddToolDefinitions;
            }
        });

        it('should add tool definitions when excludeTools is false (default)', () => {
            // Mock the addToolDefinitions method
            let addToolCallsCount = 0;
            const originalAddToolDefinitions = (streamingClient as any).addToolDefinitions;
            (streamingClient as any).addToolDefinitions = () => {
                addToolCallsCount++;
            };

            try {
                // Call prepareRequestData directly with excludeTools: false
                const requestData = (streamingClient as any).prepareRequestData(
                    [{ role: 'user', content: 'test' }],
                    undefined,
                    false,
                    false  // excludeTools: false
                );

                // Verify addToolDefinitions WAS called
                expect(addToolCallsCount).toBe(1);

            } finally {
                // Restore original method
                (streamingClient as any).addToolDefinitions = originalAddToolDefinitions;
            }
        });
    });
});