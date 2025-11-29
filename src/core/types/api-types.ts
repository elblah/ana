/**
 * API Types - External Communication Contracts
 * 
 * This module defines all types related to external API communication, including
 * request/response formats, streaming data structures, and error handling.
 * These types represent the contracts between the AI Coder application and
 * external AI services.
 * 
 * Domain: External API communication
 * Responsibilities: API contracts, streaming data, error handling, usage tracking
 */

import type { Message } from './message-types.js';
import type { MessageToolCall } from './message-types.js';

export interface ApiUsage {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
}

export interface ApiRequestData {
    model: string;
    messages: Message[];
    temperature?: number;
    max_tokens?: number;
    stream: boolean;
    tools?: Array<{
        type: 'function';
        function: {
            name: string;
            description: string;
            parameters: any;
        };
    }>;
    tool_choice?: string;
}

export interface StreamChunkData {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: {
            role?: string;
            content?: string;
            tool_calls?: MessageToolCall[];
        };
        finish_reason?: string;
    }>;
    usage?: ApiUsage;
}

export interface StreamChunk {
    choices?: Array<{
        delta?: {
            content?: string;
            tool_calls?: MessageToolCall[];
        };
        finish_reason?: string;
    }>;
    usage?: ApiUsage;
}

export class UnknownError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnknownError';
    }
}