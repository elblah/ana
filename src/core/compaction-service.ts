/**
 * Centralized compaction service - clean, simple, focused
 * Takes messages, returns compacted messages. That's it.
 */

import type { Message } from './message-history.js';
import type { MessageToolCall } from './types.js';
import type { StreamingClient } from './streaming-client.js';
import { Config } from './config.js';

interface MessageGroup {
    messages: Message[];
    isSummary: boolean;
    isUserTurn: boolean; // true if this starts with user message
}

/**
 * Simple compaction service with clean interfaces
 */
export class CompactionService {
    constructor(private apiClient: StreamingClient) {}

    /**
     * Compact messages using sliding window + AI summarization
     */
    async compact(messages: Message[]): Promise<Message[]> {
        if (messages.length <= 3) {
            return messages; // Too short to compact
        }

        // Extract summaries and find where to insert new summary
        const systemMessage = messages[0];
        const otherSummaries: Message[] = [];
        const messagesToCompact: Message[] = [];
        let lastSummaryIndex = 0; // After system message by default

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (msg.content?.startsWith('[SUMMARY]')) {
                otherSummaries.push(msg);
                lastSummaryIndex = i + 1; // After this summary
            } else if (i === 0 && msg.role === 'system') {
                // Skip system message for now, add it back later
                continue;
            } else {
                messagesToCompact.push(msg);
            }
        }

        // Group only non-summary messages for compaction
        const groups = this.groupMessages(messagesToCompact);
        const recentGroups = groups.slice(-Config.compactProtectRounds);
        const oldGroups = groups.slice(0, -Config.compactProtectRounds);

        if (oldGroups.length === 0) {
            return messages; // Nothing old enough to compact
        }

        try {
            const summary = await this.getAISummary(oldGroups);
            const summaryMessage = this.createSummaryMessage(summary);

            // Rebuild: system + existing summaries + new summary + recent messages
            const recentMessages = recentGroups.flatMap((g) => g.messages);
            const newMessages: Message[] = [
                systemMessage,
                ...otherSummaries,
                summaryMessage,
                ...recentMessages,
            ];

            return newMessages;
        } catch (error) {
            console.log(
                `${Config.colors.red}[X] Compaction failed: ${error}${Config.colors.reset}`
            );
            throw error; // Re-throw to let caller handle it
        }
    }

    /**
     * Force compact N oldest conversation rounds
     */
    async forceCompactRounds(messages: Message[], n: number): Promise<Message[]> {
        const rounds = this.identifyRounds(messages);
        if (rounds.length === 0) {
            return messages;
        }

        const roundsToCompact = rounds.slice(0, Math.min(n, rounds.length));
        if (roundsToCompact.length === 0) {
            return messages;
        }

        const messagesToCompact = roundsToCompact.flatMap((round) => round.messages);
        // Filter out any summary messages from compaction
        const filteredMessages = messagesToCompact.filter(
            (msg) => !msg.content?.startsWith('[SUMMARY]')
        );

        if (filteredMessages.length === 0) {
            return messages;
        }

        const summary = await this.getAISummary(
            filteredMessages.map((msg) => ({
                messages: [msg],
                isSummary: false,
                isUserTurn: false,
            }))
        );
        const summaryMessage = this.createSummaryMessage(summary);

        // Replace only the filtered messages, not summaries
        return this.replaceMessagesWithSummary(messages, filteredMessages, summaryMessage);
    }

    /**
     * Force compact N oldest individual messages
     */
    async forceCompactMessages(messages: Message[], n: number): Promise<Message[]> {
        const eligibleMessages = messages.filter(
            (msg) => msg.role !== 'system' && !msg.content?.startsWith('[SUMMARY]')
        );

        if (eligibleMessages.length === 0) {
            return messages;
        }

        const messagesToCompact = eligibleMessages.slice(0, Math.min(n, eligibleMessages.length));
        const summary = await this.getAISummary(
            messagesToCompact.map((msg) => ({
                messages: [msg],
                isSummary: false,
                isUserTurn: false,
            }))
        );
        const summaryMessage = this.createSummaryMessage(summary);

        return this.replaceMessagesWithSummary(messages, messagesToCompact, summaryMessage);
    }

    /**
     * Group messages into atomic units (tool calls stay with responses)
     */
    private groupMessages(messages: Message[]): MessageGroup[] {
        const groups: MessageGroup[] = [];
        let current: Message[] = [];

        for (const msg of messages) {
            current.push(msg);

            // Complete group at tool result OR new user message (not first)
            if (msg.role === 'tool' || (msg.role === 'user' && current.length > 1)) {
                groups.push({
                    messages: [...current],
                    isSummary: msg.content?.startsWith('[SUMMARY]') || false,
                    isUserTurn: msg.role === 'user',
                });
                current = msg.role === 'user' ? [msg] : [];
            }
        }

        if (current.length > 0) {
            groups.push({
                messages: current,
                isSummary: current[0].content?.startsWith('[SUMMARY]') || false,
                isUserTurn: current[0].role === 'user',
            });
        }

        return groups;
    }

    /**
     * Identify conversation rounds
     */
    private identifyRounds(messages: Message[]): Array<{ messages: Message[] }> {
        const rounds: Array<{ messages: Message[] }> = [];
        let currentRound: Message[] = [];

        for (const msg of messages) {
            if (msg.role === 'system' || msg.content?.startsWith('[SUMMARY]')) {
                continue; // Skip system and summary messages
            }

            currentRound.push(msg);

            // Round ends at next user message
            if (msg.role === 'user' && currentRound.length > 1) {
                if (currentRound.length > 1) {
                    rounds.push({ messages: [...currentRound.slice(0, -1)] });
                }
                currentRound = [msg]; // Start new round
            }
        }

        if (currentRound.length > 0) {
            rounds.push({ messages: currentRound });
        }

        return rounds;
    }

    /**
     * Get AI summary using existing streaming client
     */
    private async getAISummary(groups: MessageGroup[]): Promise<string> {
        const messages = groups.flatMap((g) => g.messages);
        const messagesToSummarize = messages.filter((msg) => !msg.content?.startsWith('[SUMMARY]'));

        if (messagesToSummarize.length === 0) {
            return 'No previous content';
        }

        const prompt = `Based on the conversation below:

Numbered conversation to analyze:
${this.formatMessagesForSummary(messagesToSummarize)}

---
Provide a detailed but concise summary of our conversation above. Focus on information that would be helpful for continuing the conversation, including what we did, what we're doing, which files we're working on, and what we're going to do next. Generate at least 1000 if you have enough information available to do so.`;

        try {
            // Use existing streaming client, collect chunks
            let fullResponse = '';

            const response = await this.apiClient.streamRequest(
                [
                    {
                        role: 'system',
                        content: `You are a helpful AI assistant tasked with summarizing conversations.

When asked to summarize, provide a detailed but concise summary of the conversation.
Focus on information that would be helpful for continuing the conversation, including:

- What was done
- What is currently being worked on
- Which files are being modified
- What needs to be done next

Your summary should be comprehensive enough to provide context but concise enough to be quickly understood.`,
                    },
                    { role: 'user', content: prompt },
                ],
                false,
                true
            ); // false = non-streaming, true = throwOnError

            for await (const chunk of response) {
                const content = chunk.choices?.[0]?.delta?.content;
                if (content) {
                    fullResponse += content;
                }
            }
            const summary = fullResponse.trim();

            if (!this.validateSummary(summary)) {
                console.log(
                    `${Config.colors.yellow}[!] Generated summary appears too short, using anyway${Config.colors.reset}`
                );
            }

            return summary || 'Conversation summarized';
        } catch (error) {
            throw new Error(`AI summarization failed: ${error}`);
        }
    }

    /**
     * Format messages for AI summarization with temporal tagging (Python strategy)
     */
    private formatMessagesForSummary(messages: Message[]): string {
        const totalMessages = messages.length;

        return messages
            .map((msg, index) => {
                const role = msg.role;
                const content = msg.content || '';

                // Calculate temporal position (Python's exact strategy)
                const currentIndex = index + 1;
                const positionRatio = currentIndex / totalMessages;
                const positionPercent = positionRatio * 100;

                // Add temporal priority indicator
                let priority: string;
                if (positionPercent >= 80) {
                    priority = '🔴 VERY RECENT (Last 20%)';
                } else if (positionPercent >= 60) {
                    priority = '🟡 RECENT (Last 40%)';
                } else if (positionPercent >= 30) {
                    priority = '🟢 MIDDLE';
                } else {
                    priority = '🔵 OLD (First 30%)';
                }

                const prefix = `[${currentIndex.toString().padStart(3)}/${totalMessages}] ${priority} `;

                // Format based on role with enhanced details
                if (role === 'assistant') {
                    const toolCalls = msg.tool_calls as MessageToolCall[];
                    if (toolCalls && toolCalls.length > 0) {
                        const toolInfo = toolCalls
                            .map((call: MessageToolCall) => {
                                const funcName = call.function?.name || 'unknown';
                                const funcArgs = call.function?.arguments || '{}';
                                return `Tool Call: ${funcName}(${funcArgs})`;
                            })
                            .join('\n');
                        return `${prefix} Assistant: ${content}\n${toolInfo}`;
                    } else {
                        return `${prefix} Assistant: ${content}`;
                    }
                } else if (role === 'tool') {
                    const toolCallId = msg.tool_call_id || 'unknown';
                    let toolContent = content;

                    // Truncate very long tool results for summarization
                    if (toolContent.length > 500) {
                        toolContent =
                            toolContent.substring(0, 500) + '... (truncated for summarization)';
                    }

                    return `${prefix} Tool Result (ID: ${toolCallId}): ${toolContent}`;
                } else if (role === 'user') {
                    return `${prefix} User: ${content}`;
                } else {
                    return `${prefix} ${role?.charAt(0).toUpperCase() + role?.slice(1)}: ${content}`;
                }
            })
            .join('\n---\n');
    }

    /**
     * Validate summary quality
     */
    private validateSummary(summary: string): boolean {
        return Boolean(summary && summary.length >= 50);
    }

    /**
     * Create summary message (user role to avoid model issues)
     */
    private createSummaryMessage(summary: string): Message {
        return {
            role: 'user',
            content: `[SUMMARY] ${summary}`,
        };
    }

    /**
     * Replace a range of messages with summary
     */
    private replaceMessagesWithSummary(
        messages: Message[],
        toReplace: Message[],
        summary: Message
    ): Message[] {
        if (toReplace.length === 0) return messages;

        // Find indices by matching content and role (more reliable than object reference)
        const firstIndex = messages.findIndex(
            (msg) => msg.role === toReplace[0].role && msg.content === toReplace[0].content
        );

        if (firstIndex === -1) return messages;

        // Find the last index by matching the last message in toReplace
        const lastMessageToReplace = toReplace[toReplace.length - 1];
        const lastIndex = messages.findIndex(
            (msg, idx) =>
                idx >= firstIndex &&
                msg.role === lastMessageToReplace.role &&
                msg.content === lastMessageToReplace.content
        );

        const actualLastIndex = lastIndex !== -1 ? lastIndex : firstIndex + toReplace.length - 1;

        return [...messages.slice(0, firstIndex), summary, ...messages.slice(actualLastIndex + 1)];
    }
}
