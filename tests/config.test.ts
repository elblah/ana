/**
 * Unit tests for Config module
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Config } from '../src/core/config.js';

describe('Config', () => {
    beforeEach(() => {
        // Reset environment variables before each test
        delete process.env.OPENAI_API_KEY;
        delete process.env.API_KEY;
        delete process.env.OPENAI_BASE_URL;
        delete process.env.API_BASE_URL;
        delete process.env.OPENAI_MODEL;
        delete process.env.API_MODEL;
        delete process.env.DEBUG;
        delete process.env.YOLO_MODE;
        delete process.env.CONTEXT_SIZE;
        delete process.env.CONTEXT_COMPACT_PERCENTAGE;
        delete process.env.TEMPERATURE;
        delete process.env.MAX_TOKENS;
        delete process.env.STREAMING_TIMEOUT;
        delete process.env.MAX_TOOL_RESULT_SIZE;
        delete process.env.MINI_SANDBOX;
    });

    it('should have default values', () => {
        expect(Config.apiKey).toBe('');
        expect(Config.baseUrl).toBe('');
        expect(Config.apiEndpoint).toBe('/chat/completions');
        expect(Config.model).toBe('');
        expect(Config.debug).toBe(false);
        expect(Config.yoloMode).toBe(false);
    });

    it('should read API key from environment', () => {
        process.env.OPENAI_API_KEY = 'test-key';
        expect(Config.apiKey).toBe('test-key');
    });

    it('should read custom base URL from environment', () => {
        process.env.OPENAI_BASE_URL = 'https://custom.endpoint.com/v1';
        expect(Config.baseUrl).toBe('https://custom.endpoint.com/v1');
        expect(Config.apiEndpoint).toBe('https://custom.endpoint.com/v1/chat/completions');
    });

    it('should read custom model from environment', () => {
        process.env.OPENAI_MODEL = 'gpt-4';
        expect(Config.model).toBe('gpt-4');
    });

    it('should enable debug mode from environment', () => {
        process.env.DEBUG = '1';
        expect(Config.debug).toBe(true);
    });

    it('should enable yolo mode from environment', () => {
        process.env.YOLO_MODE = '1';
        expect(Config.yoloMode).toBe(true);
    });

    it('should handle API_BASE_URL as fallback', () => {
        process.env.API_BASE_URL = 'https://api.fallback.com/v1';
        expect(Config.baseUrl).toBe('https://api.fallback.com/v1');
        expect(Config.apiEndpoint).toBe('https://api.fallback.com/v1/chat/completions');
    });

    it('should prioritize OPENAI_BASE_URL over API_BASE_URL', () => {
        process.env.API_BASE_URL = 'https://api.fallback.com/v1';
        process.env.OPENAI_BASE_URL = 'https://api.primary.com/v1';
        expect(Config.baseUrl).toBe('https://api.primary.com/v1');
        expect(Config.apiEndpoint).toBe('https://api.primary.com/v1/chat/completions');
    });

    it('should handle temperature configuration', () => {
        expect(Config.temperature).toBe(0.0);
        process.env.TEMPERATURE = '0.7';
        expect(Config.temperature).toBe(0.7);
    });

    it('should handle max tokens configuration', () => {
        expect(Config.maxTokens).toBe(null);
        process.env.MAX_TOKENS = '4096';
        expect(Config.maxTokens).toBe(4096);
    });

    it('should handle streaming timeout configuration', () => {
        expect(Config.streamingTimeout).toBe(300);
        process.env.STREAMING_TIMEOUT = '60';
        expect(Config.streamingTimeout).toBe(60);
    });

    it('should handle context size configuration', () => {
        expect(Config.contextSize).toBe(128000);
        process.env.CONTEXT_SIZE = '64000';
        expect(Config.contextSize).toBe(64000);
    });

    it('should handle auto-compaction configuration', () => {
        expect(Config.autoCompactEnabled).toBe(false);
        expect(Config.autoCompactThreshold).toBe(0);

        process.env.CONTEXT_COMPACT_PERCENTAGE = '50';
        expect(Config.autoCompactEnabled).toBe(true);
        expect(Config.autoCompactThreshold).toBe(64000); // 128000 * 50%
    });

    it('should handle max tool result size configuration', () => {
        expect(Config.maxToolResultSize).toBe(300000);
        process.env.MAX_TOOL_RESULT_SIZE = '100000';
        expect(Config.maxToolResultSize).toBe(100000);
    });

    it('should handle sandbox configuration', () => {
        expect(Config.sandboxDisabled).toBe(false);
        process.env.MINI_SANDBOX = '0';
        expect(Config.sandboxDisabled).toBe(true);
    });
});
