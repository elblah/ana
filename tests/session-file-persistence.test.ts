/**
 * Tests for session file persistence (JSONL)
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { JsonlUtils } from '../src/utils/jsonl-utils.js';
import { MessageHistory } from '../src/core/message-history.js';
import { Stats } from '../src/core/stats.js';
import { FileUtils } from '../src/utils/file-utils.js';
import { Config } from '../src/core/config.js';
import type { Message } from '../src/core/types/index.js';

describe('Session File Persistence', () => {
    let tempDir: string;
    let messageHistory: MessageHistory;
    let sessionFile: string;
    let jsonFile: string;

    beforeEach(async () => {
        // Create temporary directory for tests
        tempDir = `/tmp/session-test-${Date.now()}`;
        await FileUtils.writeFile(tempDir + '/.keep', '');
        
        sessionFile = tempDir + '/session.jsonl';
        jsonFile = tempDir + '/session.json';
        
        // Reset Config to ensure clean state
        Config.reset();
        
        // Create MessageHistory instance
        const stats = new Stats();
        messageHistory = new MessageHistory(stats);
    });

    afterEach(async () => {
        // Clean up temporary files
        try {
            await FileUtils.removeFile(sessionFile);
            await FileUtils.removeFile(jsonFile);
            await FileUtils.removeFile(tempDir + '/.keep');
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('JsonlUtils', () => {
        it('should append single message to JSONL file', async () => {
            const message: Message = { role: 'user', content: 'Hello world' };
            
            await JsonlUtils.appendMessage(sessionFile, message);
            
            const content = await FileUtils.readFile(sessionFile);
            expect(content.trim()).toBe(JSON.stringify(message));
        });

        it('should append multiple messages to JSONL file', async () => {
            const messages: Message[] = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there!' }
            ];
            
            await JsonlUtils.appendMessage(sessionFile, messages[0]);
            await JsonlUtils.appendMessage(sessionFile, messages[1]);
            
            const loadedMessages = await JsonlUtils.readFile(sessionFile);
            expect(loadedMessages).toEqual(messages);
        });

        it('should write all messages to JSONL file', async () => {
            const messages: Message[] = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there!' },
                { role: 'user', content: 'How are you?' }
            ];
            
            await JsonlUtils.writeMessages(sessionFile, messages);
            
            const loadedMessages = await JsonlUtils.readFile(sessionFile);
            expect(loadedMessages).toEqual(messages);
        });

        it('should handle empty JSONL file', async () => {
            await JsonlUtils.writeMessages(sessionFile, []);
            
            const loadedMessages = await JsonlUtils.readFile(sessionFile);
            expect(loadedMessages).toEqual([]);
        });

        it('should return null for safe read of non-existent file', async () => {
            const result = await JsonlUtils.readFileSafe('/non/existent/file.jsonl');
            expect(result).toBeNull();
        });

        it('should handle malformed JSONL lines', async () => {
            await FileUtils.writeFile(sessionFile, '{"role": "user"}\ninvalid json\n{"role": "assistant"}');
            
            await expect(JsonlUtils.readFile(sessionFile)).rejects.toThrow();
        });
    });

    describe('MessageHistory Integration', () => {
        it('should initialize session file when configured', async () => {
            // Set SESSION_FILE environment variable
            process.env.SESSION_FILE = sessionFile;
            
            await messageHistory.initializeSessionFile();
            
            // File should be created
            expect(await FileUtils.fileExistsAsync(sessionFile)).toBeTrue();
            
            // Should be empty initially
            const content = await FileUtils.readFile(sessionFile);
            expect(content.trim()).toBe('');
        });

        it('should load existing session file', async () => {
            // Create initial session file
            const messages: Message[] = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there!' }
            ];
            await JsonlUtils.writeMessages(sessionFile, messages);
            
            // Add a system message first (simulating current system prompt)
            messageHistory.addSystemMessage('Current system prompt');
            
            // Set SESSION_FILE and initialize
            process.env.SESSION_FILE = sessionFile;
            await messageHistory.initializeSessionFile();
            
            // Messages should be loaded with current system prompt preserved
            const loadedMessages = messageHistory.getMessages();
            expect(loadedMessages).toHaveLength(3);
            expect(loadedMessages[0]).toEqual({ role: 'system', content: 'Current system prompt' });
            expect(loadedMessages[1]).toEqual({ role: 'user', content: 'Hello' });
            expect(loadedMessages[2]).toEqual({ role: 'assistant', content: 'Hi there!' });
        });

        it('should append messages to session file when adding', async () => {
            // Set SESSION_FILE and initialize
            process.env.SESSION_FILE = sessionFile;
            await messageHistory.initializeSessionFile();
            
            // Clear initial messages (system prompt may be added)
            const initialCount = messageHistory.getMessages().length;
            
            // Add messages
            messageHistory.addUserMessage('Hello');
            messageHistory.addAssistantMessage({ content: 'Hi there!', tool_calls: [] });
            
            // Wait a bit for async operations to complete
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Check file content
            const loadedMessages = await JsonlUtils.readFile(sessionFile);
            expect(loadedMessages.length).toBeGreaterThanOrEqual(initialCount + 2);
            
            // Check the last two messages are what we added (skip any system messages)
            const userMsg = loadedMessages.find(msg => msg.role === 'user' && msg.content === 'Hello');
            const assistantMsg = loadedMessages.find(msg => msg.role === 'assistant' && msg.content === 'Hi there!');
            
            expect(userMsg).toEqual({ role: 'user', content: 'Hello' });
            expect(assistantMsg).toEqual({ role: 'assistant', content: 'Hi there!', tool_calls: [] });
        });

        it('should append tool results to session file', async () => {
            // Set SESSION_FILE and initialize
            process.env.SESSION_FILE = sessionFile;
            await messageHistory.initializeSessionFile();
            
            // Add tool results
            await messageHistory.addToolResults([
                { tool_call_id: 'tool1', content: 'Tool result 1' },
                { tool_call_id: 'tool2', content: 'Tool result 2' }
            ]);
            
            // Wait a bit for async operations to complete
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Check file content
            const loadedMessages = await JsonlUtils.readFile(sessionFile);
            expect(loadedMessages).toHaveLength(2);
            expect(loadedMessages[0]).toEqual({ role: 'tool', content: 'Tool result 1', tool_call_id: 'tool1' });
            expect(loadedMessages[1]).toEqual({ role: 'tool', content: 'Tool result 2', tool_call_id: 'tool2' });
        });

        it('should rewrite session file during compaction', async () => {
            // Set SESSION_FILE and initialize
            process.env.SESSION_FILE = sessionFile;
            await messageHistory.initializeSessionFile();
            
            // Add some messages
            messageHistory.addUserMessage('Hello');
            messageHistory.addAssistantMessage({ content: 'Hi there!', tool_calls: [] });
            
            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Simulate compaction by directly setting messages
            const compactedMessages: Message[] = [
                { role: 'system', content: 'System prompt' },
                { role: 'user', content: 'Hello' }
            ];
            messageHistory.setMessages(compactedMessages);
            
            // Rewrite session file
            await (messageHistory as any).rewriteSessionFile();
            
            // Check file content (should NOT include system message)
            const loadedMessages = await JsonlUtils.readFile(sessionFile);
            const expectedCompacted = compactedMessages.filter(msg => msg.role !== 'system');
            expect(loadedMessages).toEqual(expectedCompacted);
        });
    });

    describe('Load Command Integration', () => {
        it('should load JSONL file with /load command', async () => {
            // Create JSONL file
            const messages: Message[] = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there!' }
            ];
            await JsonlUtils.writeMessages(sessionFile, messages);
            
            // Load using load command logic
            const loadedMessages = await JsonlUtils.readFile(sessionFile);
            expect(loadedMessages).toEqual(messages);
        });
    });

    describe('Save Command Integration', () => {
        it('should save as JSONL when filename ends with .jsonl', async () => {
            const messages: Message[] = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there!' }
            ];
            
            await JsonlUtils.writeMessages(sessionFile, messages);
            
            const loadedMessages = await JsonlUtils.readFile(sessionFile);
            expect(loadedMessages).toEqual(messages);
            
            // Verify file format
            const content = await FileUtils.readFile(sessionFile);
            const lines = content.trim().split('\n');
            expect(lines).toHaveLength(2);
            expect(() => JSON.parse(lines[0])).not.toThrow();
            expect(() => JSON.parse(lines[1])).not.toThrow();
        });
    });
});