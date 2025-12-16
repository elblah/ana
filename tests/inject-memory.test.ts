import { describe, test, expect, beforeEach } from 'bun:test';
import { MessageHistory } from '../src/core/message-history.js';
import { Stats } from '../src/core/stats.js';

describe('Inject Memory Feature', () => {
    let messageHistory: MessageHistory;
    let stats: Stats;

    beforeEach(() => {
        stats = new Stats();
        messageHistory = new MessageHistory(stats);
    });

    test('should insert user message after last user message', () => {
        // Arrange: Add system, user, assistant messages
        messageHistory.addSystemMessage('System prompt');
        messageHistory.addUserMessage('First user message');
        messageHistory.addAssistantMessage({
            content: 'Assistant response',
            tool_calls: []
        });

        // Act: Inject new user message
        messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected memory');

        // Assert: Check message order (priority: assistant no tools > user)
        const messages = messageHistory.getMessages();
        expect(messages).toHaveLength(4);
        expect(messages[0].role).toBe('system');
        expect(messages[1].role).toBe('user');
        expect(messages[1].content).toBe('First user message');
        expect(messages[2].role).toBe('assistant'); // Assistant message (priority 2)
        expect(messages[2].content).toBe('Assistant response');
        expect(messages[3].role).toBe('user'); // Injected after assistant (not user)
        expect(messages[3].content).toBe('Injected memory');
    });

    test('should insert user message after last tool result', () => {
        // Arrange: Add messages ending with tool result
        messageHistory.addSystemMessage('System prompt');
        messageHistory.addUserMessage('User message');
        messageHistory.addAssistantMessage({
            content: 'Assistant response',
            tool_calls: [{ id: 'tool1', type: 'function', function: { name: 'test', arguments: '{}' } }]
        });
        messageHistory.addToolResults([{ tool_call_id: 'tool1', content: 'Tool result' }]);

        // Act: Inject new user message
        messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected memory');

        // Assert: Check message order
        const messages = messageHistory.getMessages();
        expect(messages).toHaveLength(5);
        expect(messages[messages.length - 1].role).toBe('user');
        expect(messages[messages.length - 1].content).toBe('Injected memory');
        expect(messages[messages.length - 2].role).toBe('tool');
    });

    test('should insert after whichever comes later (user vs tool)', () => {
        // Arrange: Add user message, then tool result later
        messageHistory.addSystemMessage('System prompt');
        messageHistory.addUserMessage('Early user message');
        messageHistory.addAssistantMessage({
            content: 'Assistant response',
            tool_calls: []
        });
        messageHistory.addUserMessage('Later user message');
        messageHistory.addAssistantMessage({
            content: 'Another response',
            tool_calls: [{ id: 'tool2', type: 'function', function: { name: 'test2', arguments: '{}' } }]
        });
        messageHistory.addToolResults([{ tool_call_id: 'tool2', content: 'Tool result after last user' }]);

        // Act: Inject new user message
        messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected memory');

        // Assert: Should insert after tool result (which is later)
        const messages = messageHistory.getMessages();
        expect(messages[messages.length - 1].role).toBe('user');
        expect(messages[messages.length - 1].content).toBe('Injected memory');
        expect(messages[messages.length - 2].role).toBe('tool');
    });

    test('should insert at end when no user messages or tool results exist', () => {
        // Arrange: Only system messages
        messageHistory.addSystemMessage('System prompt');
        messageHistory.addSystemMessage('Another system message');

        // Act: Inject new user message
        messageHistory.insertUserMessageAfterLastAppropriatePosition('Injected memory');

        // Assert: Should append to end when no tool/assistant/user messages found
        const messages = messageHistory.getMessages();
        expect(messages).toHaveLength(3);
        expect(messages[0].role).toBe('system');
        expect(messages[0].content).toBe('System prompt');
        expect(messages[1].role).toBe('system');
        expect(messages[1].content).toBe('Another system message');
        expect(messages[2].role).toBe('user'); // User message appended at end
        expect(messages[2].content).toBe('Injected memory');
    });

    test('should insert at correct position in empty history', () => {
        // Arrange: Empty history

        // Act: Inject new user message
        messageHistory.insertUserMessageAfterLastAppropriatePosition('First injected memory');

        // Assert: Should be first message
        const messages = messageHistory.getMessages();
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe('user');
        expect(messages[0].content).toBe('First injected memory');
    });

    test('should increment stats when inserting user message', () => {
        // Arrange: Start with empty history
        const initialMessagesSent = stats.messagesSent;

        // Act: Inject new user message
        messageHistory.insertUserMessageAfterLastAppropriatePosition('Test injection');

        // Assert: Stats should be incremented
        expect(stats.messagesSent).toBe(initialMessagesSent + 1);
    });
});