/**
 * Streaming API client for AI Coder using native Bun functions
 */

import { Config } from './config.js';
import type { Stats } from './stats.js';
import { LogUtils } from '../utils/log-utils.js';
import type { 
    Message, 
    MessageToolCall,
    ApiUsage, 
    ApiRequestData, 
    UnknownError,
    StreamChunk
} from './types/index.js';
import type { ToolManager } from './tool-manager.js';
import { MarkdownColorizer } from './markdown-colorizer.js';

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
    async *streamRequest(
        messages: Message[],
        stream = true,
        throwOnError = false
    ): AsyncGenerator<StreamChunk, void, unknown> {
        const startTime = Date.now();
        this.stats.incrementApiRequests();

        // Just use the configured provider, retry up to 3 times
        const maxRetries = 3;

        for (let attemptNum = 1; attemptNum <= maxRetries; attemptNum++) {
            const config = { baseUrl: Config.baseUrl, model: Config.model };

            try {
                this.logRetryAttempt(config, attemptNum);
                const requestData = this.prepareRequestData(messages, config.model, stream);
                const endpoint = `${config.baseUrl}/chat/completions`;

                this.logRequestDetails(endpoint, config, requestData, attemptNum);
                const headers = this.buildHeaders();

                this.logApiConfigDebug(config);

                const response = await this.makeApiRequest(endpoint, headers, requestData);
                
                if (!response.ok) {
                    this.logErrorResponse(response);
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const contentType = response.headers.get('content-type') || '';
                
                if (this.isStreamingResponse(contentType)) {
                    yield* this.handleStreamingResponse(response);
                } else {
                    yield* this.handleNonStreamingResponse(response);
                }

                this.updateStatsOnSuccess(startTime);
                return; // Success - exit retry loop
            } catch (error) {
                if (!this.handleAttemptError(error, attemptNum, maxRetries, throwOnError, startTime)) {
                    return;
                }
            }
        }
    }

    /**
     * Log retry attempt information
     */
    private logRetryAttempt(config: { baseUrl: string; model: string }, attemptNum: number): void {
        if (Config.debug && attemptNum > 1) {
            LogUtils.debug(
                `*** Retrying: ${config.baseUrl} with model ${config.model}`,
                Config.colors.yellow
            );
        }
    }

    /**
     * Log request details for debugging
     */
    private logRequestDetails(endpoint: string, config: { model: string }, requestData: any, attemptNum: number): void {
        if (Config.debug || attemptNum > 1) {
            LogUtils.debug(
                `*** Attempt ${attemptNum}: POST ${endpoint}`,
                Config.colors.yellow
            );
            LogUtils.debug(
                `*** Model: ${config.model}, Messages: ${requestData.messages?.length || 0}`,
                Config.colors.yellow
            );
            LogUtils.debug(
                `*** Request size: ${JSON.stringify(requestData).length} bytes`,
                Config.colors.yellow
            );
        }
    }

    /**
     * Build HTTP headers for API request
     */
    private buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0',
            Referer: 'http://localhost',
        };

        // Only add Authorization header if API key is configured
        if (Config.apiKey) {
            headers['Authorization'] = `Bearer ${Config.apiKey}`;
        }

        return headers;
    }

    /**
     * Log API configuration for debugging
     */
    private logApiConfigDebug(config: { baseUrl: string; model: string }): void {
        if (Config.debug) {
            LogUtils.debug('=== API REQUEST DEBUG ===');
            LogUtils.debug(`Base URL: ${config.baseUrl}`);
            LogUtils.debug(`Model: ${config.model}`);
            LogUtils.debug(`API Key: ${Config.apiKey ? Config.apiKey.substring(0, 8) + '...' : 'NOT SET'}`);
            LogUtils.debug('=== END DEBUG ===');
        }
    }

    /**
     * Make the actual API request
     */
    private async makeApiRequest(endpoint: string, headers: Record<string, string>, requestData: any): Promise<Response> {
        return await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestData),
            signal: AbortSignal.timeout(Config.totalTimeout), // Total timeout per attempt
        });
    }

    /**
     * Log error response details
     */
    private logErrorResponse(response: Response): void {
        LogUtils.error('HTTP Error Response:');
        LogUtils.error(`  Status: ${response.status} ${response.statusText}`);
        LogUtils.error(
            `  Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`
        );
    }

    /**
     * Check if response is streaming
     */
    private isStreamingResponse(contentType: string): boolean {
        return contentType.includes('text/event-stream') || contentType.includes('text/plain');
    }

    /**
     * Handle streaming response
     */
    private async *handleStreamingResponse(response: Response): AsyncGenerator<StreamChunk, void, unknown> {
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
                            LogUtils.error(`SSE Parse Error: ${error}`);
                            LogUtils.error(`Raw data: ${data.substring(0, 200)}`);
                            continue;
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Handle non-streaming response
     */
    private async *handleNonStreamingResponse(response: Response): AsyncGenerator<StreamChunk, void, unknown> {
        const data = await response.json();

        // Convert non-streaming response to streaming format
        if (data.choices && data.choices.length > 0) {
            const choice = data.choices[0];

            if (choice.message) {
                // Create a synthetic streaming chunk from the complete message
                const chunk: StreamChunk = {
                    choices: [
                        {
                            delta: {
                                content: choice.message.content,
                                tool_calls: choice.message.tool_calls,
                            },
                            finish_reason: choice.finish_reason,
                        },
                    ],
                    usage: data.usage,
                };
                yield chunk;
            }
        }
    }

    /**
     * Handle errors from individual attempts
     */
    private handleAttemptError(
        error: unknown, 
        attemptNum: number, 
        maxRetries: number, 
        throwOnError: boolean,
        startTime: number
    ): boolean {
        this.logAttemptError(error, attemptNum);
        
        if (attemptNum === maxRetries) {
            // Last attempt failed
            return this.handleFinalAttemptFailure(error, throwOnError, startTime);
        }

        // Not the last attempt - log and continue
        LogUtils.warn(`Attempt ${attemptNum} failed: ${error instanceof Error ? error.message : String(error)}. Retrying...`);
        return true; // Continue to next attempt
    }

    /**
     * Log error details for debugging
     */
    private logAttemptError(error: unknown, attemptNum: number): void {
        if (Config.debug) {
            LogUtils.error(`Attempt ${attemptNum} failed: ${error}`);
            LogUtils.error(`Error type: ${typeof error}`);
            LogUtils.error(
                `Error stack: ${error instanceof Error ? error.stack : 'No stack'}`
            );
        }
    }

    /**
     * Handle final attempt failure
     */
    private handleFinalAttemptFailure(error: unknown, throwOnError: boolean, startTime: number): boolean {
        this.stats.incrementApiErrors();
        this.stats.addApiTime((Date.now() - startTime) / 1000);

        const errorMessage = `All API attempts failed. Last error: ${error instanceof Error ? error.message : String(error)}`;
        LogUtils.error(errorMessage);

        if (throwOnError) {
            throw new Error(errorMessage);
        }

        // Return false to exit retry loop
        return false;
    }

    /**
     * Update statistics on successful request
     */
    private updateStatsOnSuccess(startTime: number): void {
        this.stats.incrementApiSuccess();
        this.stats.addApiTime((Date.now() - startTime) / 1000);
    }

    /**
     * Prepare request data for API with internal tools only
     */
    private prepareRequestData(messages: Message[], model?: string, stream = true): ApiRequestData {
        const data: ApiRequestData = {
            model: model || Config.model,
            messages: messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
                ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
                ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
            })),
            stream,
        };

        this.addOptionalParameters(data);
        this.addToolDefinitions(data);
        this.validateRequestSize(data);

        return data;
    }

    /**
     * Add optional parameters to request data
     */
    private addOptionalParameters(data: ApiRequestData): void {
        // Add temperature if specified
        if (process.env.TEMPERATURE) {
            data.temperature = Config.temperature;
        }

        // Add max_tokens if specified
        if (Config.maxTokens) {
            data.max_tokens = Config.maxTokens;
        }
    }

    /**
     * Add tool definitions to request data
     */
    private addToolDefinitions(data: ApiRequestData): void {
        const toolDefinitions = this.toolManager.getToolDefinitions();
        if (toolDefinitions && toolDefinitions.length > 0) {
            data.tools = toolDefinitions;
            data.tool_choice = 'auto';

            LogUtils.debug(
                `*** Tool definitions count: ${toolDefinitions.length}`,
                Config.colors.yellow
            );
            LogUtils.debug(`*** Message count: ${data.messages?.length || 0}`, Config.colors.yellow);
        }
    }

    /**
     * Validate request size to prevent HTTP errors
     */
    private validateRequestSize(data: ApiRequestData): void {
        const requestData = JSON.stringify(data);
        const reqSize = Buffer.byteLength(requestData, 'utf8');

        LogUtils.debug(`*** Request size: ${reqSize} bytes`, Config.colors.yellow);

        // Prevent oversized requests (common cause of 401/413 errors)
        const maxRequestSize = 1024 * 1024; // 1MB
        if (reqSize > maxRequestSize) {
            throw new Error(
                `Request too large (${reqSize} bytes). Maximum ${maxRequestSize} bytes allowed. Try reducing context or file sizes.`
            );
        }
    }

    /**
     * Update token statistics from usage info
     */
    updateTokenStats(usage?: ApiUsage): void {
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