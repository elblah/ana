/**
 * Enhanced token estimation based on Python implementation
 * More accurate than simple 4 chars per token while remaining fast and dependency-free
 */

// Token estimation weights (matching Python config)
const TOKEN_LETTER_WEIGHT = 4.2;
const TOKEN_NUMBER_WEIGHT = 3.5;
const TOKEN_PUNCTUATION_WEIGHT = 1.0;
const TOKEN_WHITESPACE_WEIGHT = 0.15;
const TOKEN_OTHER_WEIGHT = 3.0;

// Punctuation set for fast lookup
const PUNCTUATION_SET = new Set([
  '!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/',
  ':', ';', '<', '=', '>', '?', '@', '[', '\\', ']', '^', '_', '`', '{', '|', '}', '~'
]);

/**
 * Estimate the number of tokens in a text string
 * Uses enhanced character-based estimation that accounts for different content types
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Count character types
  let letters = 0;
  let numbers = 0;
  let punctuation = 0;
  let whitespace = 0;
  let other = 0;

  for (const char of text) {
    if (/[a-zA-Z]/.test(char)) {
      letters++;
    } else if (/[0-9]/.test(char)) {
      numbers++;
    } else if (PUNCTUATION_SET.has(char)) {
      punctuation++;
    } else if (/\s/.test(char)) {
      whitespace++;
    } else {
      other++;
    }
  }

  // Use configurable weights (matching Python implementation)
  const tokenEstimate = (
    letters / TOKEN_LETTER_WEIGHT
    + numbers / TOKEN_NUMBER_WEIGHT
    + punctuation * TOKEN_PUNCTUATION_WEIGHT
    + whitespace * TOKEN_WHITESPACE_WEIGHT
    + other / TOKEN_OTHER_WEIGHT
  );

  return Math.round(Math.max(0, tokenEstimate));
}

// Cache for message token estimation (like Python version)
const messageTokenCache = new Map<any, number>();
let lastToolDefinitionsTokens = 0;

/**
 * Estimate tokens for a message array (matching Python implementation)
 * Based on real API testing, this estimates the full API request JSON including:
 * - Message content
 * - JSON structure (field names, quotes, braces)
 * - Tool definitions (if any)
 */
export function estimateMessagesTokens(messages: any[]): number {
  if (!messages || messages.length === 0) {
    return 0;
  }

  let tokenCount = 0;

  // Estimate tokens for each message (with caching like Python)
  for (const msg of messages) {
    if (messageTokenCache.has(msg)) {
      tokenCount += messageTokenCache.get(msg)!;
    } else {
      const msgJson = JSON.stringify(msg);
      const msgTokens = estimateTokens(msgJson);
      messageTokenCache.set(msg, msgTokens);
      tokenCount += msgTokens;
    }
  }

  // Add tool definitions tokens (if any)
  tokenCount += lastToolDefinitionsTokens;

  return tokenCount;
}

/**
 * Set tool definitions tokens for estimation (called when tools are used)
 */
export function setToolDefinitionsTokens(tokens: number): void {
  lastToolDefinitionsTokens = tokens;
}

/**
 * Clear the token cache
 * Called when messages are cleared or replaced to prevent stale cache entries
 */
export function clearTokenCache(): void {
  messageTokenCache.clear();
  lastToolDefinitionsTokens = 0;
}