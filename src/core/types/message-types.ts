/**
 * Message Types - Core Domain Entities
 * 
 * This module defines the fundamental message and conversation types that form
 * the core domain model of the AI Coder application. These types represent the
 * primary data structures used throughout the system for communication between
 * the user, AI, and tools.
 * 
 * Domain: Core message/conversation handling
 * Responsibilities: Message structure, content management, conversation flow
 */

export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: string;
    tool_calls?: MessageToolCall[];
    tool_call_id?: string;
}

export interface MessageToolCall {
    id: string;
    type: string;
    function: {
        name: string;
        arguments: string;
    };
    index?: number;
}

export interface AssistantMessage {
    content?: string;
    tool_calls?: MessageToolCall[];
}

export interface ToolResultData {
    tool_call_id: string;
    content: string;
}