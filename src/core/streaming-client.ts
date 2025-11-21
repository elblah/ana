/**
 * Streaming API client for AI Coder using native Bun functions
 */

import { Config } from './config.js';
import { Stats } from './stats.js';
import { Message } from './message-history.js';
import { ToolManager } from './tool-manager.js';
import { MarkdownColorizer } from './markdown-colorizer.js';

export interface StreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id: string;
        type: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export class StreamingClient {
  private stats: Stats;
  private toolManager: ToolManager;
  private colorizer: MarkdownColorizer;

  constructor(stats: Stats, toolManager: ToolManager) {
    this.stats = stats;
    this.toolManager = toolManager;
    this.colorizer = new MarkdownColorizer();
  }

  /**
   * Make API request (streaming or non-streaming)
   */
  async *streamRequest(messages: Message[], stream: boolean = true, throwOnError: boolean = false): AsyncGenerator<StreamChunk, void, unknown> {
    const startTime = Date.now();
    this.stats.incrementApiRequests();

    // Just use the configured provider, retry up to 3 times
    const maxRetries = 3;
    
    for (let attemptNum = 1; attemptNum <= maxRetries; attemptNum++) {
      const config = { baseUrl: Config.baseUrl, model: Config.model };
      
      try {
        if (Config.debug && attemptNum > 1) {
          console.log(`${Config.colors.yellow}*** Retrying: ${config.baseUrl} with model ${config.model}${Config.colors.reset}`);
        }

        const requestData = this.prepareRequestData(messages, config.model, stream);
        const endpoint = `${config.baseUrl}/chat/completions`;

        // Debug: Log request details
        if (Config.debug || attemptNum > 1) {
          console.log(`${Config.colors.yellow}*** Attempt ${attemptNum}: POST ${endpoint}${Config.colors.reset}`);
          console.log(`${Config.colors.yellow}*** Model: ${config.model}, Messages: ${messages.length}${Config.colors.reset}`);
          console.log(`${Config.colors.yellow}*** Request size: ${JSON.stringify(requestData).length} bytes${Config.colors.reset}`);
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'http://localhost',
        };

        // Only add Authorization header if API key is configured
        if (Config.apiKey) {
          headers['Authorization'] = `Bearer ${Config.apiKey}`;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestData),
          signal: AbortSignal.timeout(Config.totalTimeout), // Total timeout per attempt
        });

        if (!response.ok) {
          // Log more details about the failed response
          console.error(`${Config.colors.red}HTTP Error Response:${Config.colors.reset}`);
          console.error(`${Config.colors.red}  Status: ${response.status} ${response.statusText}${Config.colors.reset}`);
          console.error(`${Config.colors.red}  Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}${Config.colors.reset}`);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Check if response is streaming or not
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
          // Handle streaming response
          if (!response.body) {
            throw new Error('No response body for streaming');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    return;
                  }

                  try {
                    const chunk: StreamChunk = JSON.parse(data);
                    yield chunk;
                  } catch (error) {
                    console.error(`${Config.colors.red}SSE Parse Error: ${error}${Config.colors.reset}`);
                    console.error(`${Config.colors.red}Raw data: ${data.substring(0, 200)}${Config.colors.reset}`);
                    continue;
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        } else {
          // Handle non-streaming response
          const data = await response.json();
          
          // Convert non-streaming response to streaming format
          if (data.choices && data.choices.length > 0) {
            const choice = data.choices[0];
            
            if (choice.message) {
              // Create a synthetic streaming chunk from the complete message
              const chunk: StreamChunk = {
                choices: [{
                  delta: {
                    content: choice.message.content,
                    tool_calls: choice.message.tool_calls
                  },
                  finish_reason: choice.finish_reason
                }],
                usage: data.usage
              };
              yield chunk;
            }
          }
        }

        // Update stats on success
        this.stats.incrementApiSuccess();
        this.stats.addApiTime((Date.now() - startTime) / 1000);
        return; // Success, exit the loop

      } catch (error) {
        if (Config.debug) {
          console.error(`${Config.colors.red}Attempt ${attemptNum} failed: ${error}${Config.colors.reset}`);
          console.error(`${Config.colors.red}Error type: ${typeof error}${Config.colors.reset}`);
          console.error(`${Config.colors.red}Error stack: ${error instanceof Error ? error.stack : 'No stack'}${Config.colors.reset}`);
        }
        
        if (attemptNum === maxRetries) {
          // Last attempt failed - yield a helpful message
          this.stats.incrementApiErrors();
          this.stats.addApiTime((Date.now() - startTime) / 1000);
          
          const errorMsg = `All API attempts failed. Last error: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`${Config.colors.red}${errorMsg}${Config.colors.reset}`);

          if (throwOnError) {
            throw new Error(`All API attempts failed. Last error: ${error instanceof Error ? error.message : String(error)}`);
          }
          
          const helpMessage = `\n\n[Unable to connect to AI service. The tool executed successfully, but I cannot provide additional analysis. Please try again later.]`;
          
          yield {
            choices: [{
              delta: { 
                content: helpMessage
              },
              finish_reason: 'stop'
            }]
          };
        }
      }
    }
  }

  /**
   * Prepare request data for API with internal tools only
   */
  private prepareRequestData(messages: Message[], model?: string, stream: boolean = true): any {
    const data: any = {
      model: model || Config.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
        ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
      })),
      stream,
    };

    // Add temperature if specified
    if (process.env.TEMPERATURE) {
      data.temperature = Config.temperature;
    }

    // Add max_tokens if specified
    if (Config.maxTokens) {
      data.max_tokens = Config.maxTokens;
    }

    // Add internal tools only
    const toolDefinitions = this.toolManager.getToolDefinitions();
    if (toolDefinitions.length > 0) {
      data.tools = toolDefinitions;
      data.tool_choice = 'auto';
      
      if (Config.debug) {
        console.log(`${Config.colors.yellow}*** Tool definitions count: ${toolDefinitions.length}${Config.colors.reset}`);
        console.log(`${Config.colors.yellow}*** Message count: ${messages.length}${Config.colors.reset}`);
      }
    }

    // Validate request size to prevent HTTP errors
    const requestData = JSON.stringify(data);
    const reqSize = Buffer.byteLength(requestData, 'utf8');

    if (Config.debug) {
      console.log(`${Config.colors.yellow}*** Request size: ${reqSize} bytes${Config.colors.reset}`);
    }

    // Prevent oversized requests (common cause of 401/413 errors)
    const maxRequestSize = 1024 * 1024; // 1MB
    if (reqSize > maxRequestSize) {
      throw new Error(`Request too large (${reqSize} bytes). Maximum ${maxRequestSize} bytes allowed. Try reducing context or file sizes.`);
    }

    return JSON.parse(requestData);

    return data;
  }

  /**
   * Update token statistics from usage info
   */
  updateTokenStats(usage?: any): void {
    if (usage) {
      if (usage.prompt_tokens) {
        this.stats.addPromptTokens(usage.prompt_tokens);
      }
      if (usage.completion_tokens) {
        this.stats.addCompletionTokens(usage.completion_tokens);
      }
      if (usage.total_tokens) {
        this.stats.tokensProcessed = usage.total_tokens;
      }
    }
  }

  /**
   * Process content with markdown colorization
   */
  processWithColorization(content: string): string {
    return this.colorizer.processWithColorization(content);
  }

  /**
   * Reset colorizer state (for new responses)
   */
  resetColorizer(): void {
    this.colorizer.resetState();
  }
}