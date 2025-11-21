/**
 * Message history management for AI Coder
 * Simple storage with delegated compaction logic
 */

import { Stats } from './stats.js';
import { CompactionService } from './compaction-service.js';
import { Config } from './config.js';
import { estimateMessagesTokens, clearTokenCache } from './token-estimator.js';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export class MessageHistory {
  private messages: Message[] = [];
  private initialSystemPrompt: Message | null = null;
  private stats: Stats;
  private compactionCount: number = 0;
  private apiClient: any; // Will be set by main app
  private isCompacting: boolean = false; // Prevent concurrent compactions

  constructor(stats: Stats, apiClient?: any) {
    this.stats = stats;
    this.apiClient = apiClient;
  }

  /**
   * Set API client reference for compaction
   */
  setApiClient(apiClient: any): void {
    this.apiClient = apiClient;
  }

  /**
   * Add a system message
   */
  addSystemMessage(content: string): void {
    const message: Message = { role: 'system', content };
    this.messages.push(message);
    this.estimateContext();

    if (!this.initialSystemPrompt) {
      this.initialSystemPrompt = message;
    }
  }

  /**
   * Add a user message
   */
  addUserMessage(content: string): void {
    const message: Message = { role: 'user', content };
    this.messages.push(message);
    this.stats.incrementMessagesSent();
    // Update context size estimate
    this.estimateContext();
  }

  /**
   * Add an assistant message
   */
  addAssistantMessage(message: any): void {
    const assistantMessage: Message = {
      role: 'assistant',
      content: message.content,
      tool_calls: message.tool_calls,
    };
    this.messages.push(assistantMessage);
    // Update context size estimate
    this.estimateContext();
  }

  /**
   * Add tool results
   */
  addToolResults(toolResults: any[]): void {
    for (const result of toolResults) {
      const toolMessage: Message = {
        role: 'tool',
        content: result.content,
        tool_call_id: result.tool_call_id,
      };
      this.messages.push(toolMessage);
    }
    // Update context size estimate
    this.estimateContext();
  }

  /**
   * Get all messages
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Get messages excluding initial system prompt
   */
  getChatMessages(): Message[] {
    if (!this.initialSystemPrompt || this.messages.length <= 1) {
      return this.messages;
    }
    return this.messages.slice(1);
  }

  /**
   * Estimate context size in tokens
   */
  estimateContext(): void {
    try {
      // Enhanced token estimation using the new token estimator
      // Guard against invalid values
      if (!this.messages || this.messages.length === 0) {
        this.stats.setCurrentPromptSize(0, true);
        return;
      }

      const estimatedTokens = estimateMessagesTokens(this.messages);
      
      // Cap at reasonable maximum to prevent display issues
      const cappedTokens = Math.min(estimatedTokens, 9999999);
      
      this.stats.setCurrentPromptSize(cappedTokens, true);
    } catch (error) {
      // If JSON.stringify fails, reset to 0
      this.stats.setCurrentPromptSize(0, true);
    }
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.messages = [];
    this.initialSystemPrompt = null;
    this.compactionCount = 0;
    clearTokenCache();
  }

  /**
   * Directly set messages (useful for loading sessions and compaction)
   */
  setMessages(messages: Message[]): void {
    this.messages = [...messages];
    // Clear token cache when messages are replaced to prevent stale cache entries
    clearTokenCache();
    // Update context size estimate when messages are set
    this.estimateContext();

    // Set initial system prompt if present
    if (messages.length > 0 && messages[0].role === 'system') {
      this.initialSystemPrompt = messages[0];
    } else {
      this.initialSystemPrompt = null;
    }
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Get chat message count (excluding system)
   */
  getChatMessageCount(): number {
    return this.getChatMessages().length;
  }

  /**
   * Get the initial system prompt
   */
  getInitialSystemPrompt(): Message | null {
    return this.initialSystemPrompt;
  }

  /**
   * Increment compaction counter
   */
  incrementCompactionCount(): void {
    this.compactionCount++;
  }

  /**
   * Get compaction count
   */
  getCompactionCount(): number {
    return this.compactionCount;
  }

  /**
   * Compact memory using CompactionService
   */
  async compactMemory(): Promise<void> {
    // Prevent concurrent compactions
    if (this.isCompacting) {
      console.log('[!] Compaction already in progress, skipping...');
      return;
    }

    if (!this.apiClient) {
      console.log('[!] API client not available for compaction');
      return;
    }

    this.isCompacting = true;
    try {
      const compaction = new CompactionService(this.apiClient);
      const originalCount = this.messages.length;

      const newMessages = await compaction.compact(this.messages);
      this.setMessages(newMessages);

      if (this.messages.length < originalCount) {
        this.compactionCount++;
        console.log('[✓] Conversation compacted successfully');
      }
    } finally {
      this.isCompacting = false;
    }
  }

  /**
   * Force compact N oldest rounds
   */
  async forceCompactRounds(n: number): Promise<void> {
    if (!this.apiClient) {
      console.log('[!] API client not available for compaction');
      return;
    }

    const compaction = new CompactionService(this.apiClient);
    const originalCount = this.messages.length;

    const newMessages = await compaction.forceCompactRounds(this.messages, n);
    this.setMessages(newMessages);

    if (this.messages.length < originalCount) {
      this.compactionCount++;
      console.log(`[✓] Force compacted ${n} round(s)`);
    }
  }

  /**
   * Force compact N oldest messages
   */
  async forceCompactMessages(n: number): Promise<void> {
    if (!this.apiClient) {
      console.log('[!] API client not available for compaction');
      return;
    }

    const compaction = new CompactionService(this.apiClient);
    const originalCount = this.messages.length;

    const newMessages = await compaction.forceCompactMessages(this.messages, n);
    this.setMessages(newMessages);

    if (this.messages.length < originalCount) {
      this.compactionCount++;
      console.log(`[✓] Force compacted ${n} message(s)`);
    }
  }

  /**
   * Check if auto-compaction should be triggered
   */
  shouldAutoCompact(): boolean {
    if (!Config.autoCompactEnabled) {
      return false;
    }
    return this.stats.currentPromptSize >= Config.autoCompactThreshold;
  }

  /**
   * Get number of conversation rounds
   * A round = user message + assistant response (including tools)
   */
  getRoundCount(): number {
    const chatMessages = this.getChatMessages();
    let rounds = 0;
    let inUserMessage = false;

    for (const message of chatMessages) {
      if (message.role === 'user') {
        if (!inUserMessage) {
          rounds++;
          inUserMessage = true;
        }
      } else {
        inUserMessage = false;
      }
    }

    return rounds;
  }
}