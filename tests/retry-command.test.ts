/**
 * Tests for retry command functionality
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Config } from '../src/core/config.js';
import { RetryCommand } from '../src/core/commands/retry.js';

// Mock the context
const mockContext = {
    messageHistory: {
        getMessages: () => [],
        addMessage: () => {},
        clear: () => {}
    },
    inputHandler: {
        getPrompt: () => '> '
    },
    stats: {
        incrementApiRequests: () => {},
        updateStatsOnSuccess: () => {},
        updateStatsOnError: () => {}
    }
};

describe('RetryCommand', () => {
    let retryCommand: RetryCommand;

    beforeEach(() => {
        Config.reset();
        retryCommand = new RetryCommand(mockContext);
    });

    describe('basic retry functionality', () => {
        it('should retry when user messages exist', async () => {
            // Mock message history with user message
            const mockContextWithUser = {
                ...mockContext,
                messageHistory: {
                    ...mockContext.messageHistory,
                    getMessages: () => [
                        { role: 'system', content: 'You are a helpful assistant' },
                        { role: 'user', content: 'Hello world' }
                    ]
                }
            };
            const retryCommandWithUser = new RetryCommand(mockContextWithUser);
            
            const result = await retryCommandWithUser.execute([]);
            expect(result.shouldQuit).toBe(false);
            expect(result.runApiCall).toBe(true);
        });

        it('should not retry when no user messages exist', async () => {
            // Mock message history without user messages
            const mockContextNoUser = {
                ...mockContext,
                messageHistory: {
                    ...mockContext.messageHistory,
                    getMessages: () => [
                        { role: 'system', content: 'You are a helpful assistant' },
                        { role: 'assistant', content: 'Hello!' }
                    ]
                }
            };
            const retryCommandNoUser = new RetryCommand(mockContextNoUser);
            
            const result = await retryCommandNoUser.execute([]);
            expect(result.shouldQuit).toBe(false);
            expect(result.runApiCall).toBe(false);
        });

        it('should retry with unknown subcommand when user messages exist', async () => {
            // Mock message history with user message
            const mockContextWithUser = {
                ...mockContext,
                messageHistory: {
                    ...mockContext.messageHistory,
                    getMessages: () => [
                        { role: 'system', content: 'You are a helpful assistant' },
                        { role: 'user', content: 'Hello world' }
                    ]
                }
            };
            const retryCommandWithUser = new RetryCommand(mockContextWithUser);
            
            const result = await retryCommandWithUser.execute(['unknown']);
            expect(result.shouldQuit).toBe(false);
            expect(result.runApiCall).toBe(true);
        });

        it('should not retry with unknown subcommand when no user messages exist', async () => {
            // Mock message history without user messages
            const mockContextNoUser = {
                ...mockContext,
                messageHistory: {
                    ...mockContext.messageHistory,
                    getMessages: () => [
                        { role: 'system', content: 'You are a helpful assistant' }
                    ]
                }
            };
            const retryCommandNoUser = new RetryCommand(mockContextNoUser);
            
            const result = await retryCommandNoUser.execute(['unknown']);
            expect(result.shouldQuit).toBe(false);
            expect(result.runApiCall).toBe(false);
        });
    });

    describe('help functionality', () => {
        it('should show help when "help" subcommand is used', async () => {
            const result = await retryCommand.execute(['help']);
            expect(result.shouldQuit).toBe(false);
            expect(result.runApiCall).toBe(false);
        });
    });

    describe('auto retry configuration', () => {
        it('should enable auto retry', async () => {
            const result = await retryCommand.execute(['auto', 'on']);
            expect(result.shouldQuit).toBe(false);
            expect(result.runApiCall).toBe(false);
            expect(Config.effectiveAutoRetry).toBe(true);
        });

        it('should disable auto retry', async () => {
            const result = await retryCommand.execute(['auto', 'off']);
            expect(result.shouldQuit).toBe(false);
            expect(result.runApiCall).toBe(false);
            expect(Config.effectiveAutoRetry).toBe(false);
        });

        it('should show current auto retry status', async () => {
            const result = await retryCommand.execute(['auto']);
            expect(result.shouldQuit).toBe(false);
            expect(result.runApiCall).toBe(false);
        });
    });

    describe('retry limit configuration', () => {
        it('should set retry limit', async () => {
            const result = await retryCommand.execute(['limit', '5']);
            expect(result.shouldQuit).toBe(false);
            expect(result.runApiCall).toBe(false);
            expect(Config.effectiveMaxRetries).toBe(5);
        });

        it('should set unlimited retries', async () => {
            const result = await retryCommand.execute(['limit', '0']);
            expect(result.shouldQuit).toBe(false);
            expect(result.runApiCall).toBe(false);
            expect(Config.effectiveMaxRetries).toBe(0);
        });

        it('should show current retry limit', async () => {
            const result = await retryCommand.execute(['limit']);
            expect(result.shouldQuit).toBe(false);
            expect(result.runApiCall).toBe(false);
        });
    });

    describe('backoff configuration', () => {
        it('should set backoff time', async () => {
            const result = await retryCommand.execute(['backoff', '30']);
            expect(result.shouldQuit).toBe(false);
            expect(result.runApiCall).toBe(false);
            expect(Config.effectiveRetryMaxWait).toBe(30);
        });

        it('should show current backoff time', async () => {
            const result = await retryCommand.execute(['backoff']);
            expect(result.shouldQuit).toBe(false);
            expect(result.runApiCall).toBe(false);
        });
    });

    describe('config status', () => {
        it('should return retry configuration status', () => {
            Config.setRuntimeMaxRetries(5);
            Config.setRuntimeAutoRetry(false);
            Config.setRuntimeRetryMaxWait(30);

            const status = Config.getRetryConfigStatus();
            expect(status.maxRetries).toBe(5);
            expect(status.maxBackoff).toBe(30);
            expect(status.autoRetry).toBe(false);
            expect(status.isRuntimeOverrides).toBe(true);
        });

        it('should use environment defaults when no runtime overrides', () => {
            const status = Config.getRetryConfigStatus();
            expect(status.maxRetries).toBe(3); // Default from env
            expect(status.maxBackoff).toBe(64); // Default from env
            expect(status.autoRetry).toBe(true); // Default behavior
            expect(status.isRuntimeOverrides).toBe(false);
        });
    });

    describe('aliases', () => {
        it('should return correct aliases', () => {
            const aliases = retryCommand.getAliases();
            expect(aliases).toContain('r');
        });
    });
});