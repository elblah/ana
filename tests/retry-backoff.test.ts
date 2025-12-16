/**
 * Unit tests for exponential backoff retry mechanism
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Config } from '../src/core/config.js';

describe('Retry Backoff Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset environment before each test
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    describe('Config default values', () => {
        it('should have default max retries of 3', () => {
            delete process.env.MAX_RETRIES;
            expect(Config.maxRetries).toBe(3);
        });

        it('should have default max wait of 64 seconds', () => {
            delete process.env.RETRY_MAX_WAIT;
            expect(Config.retryMaxWait).toBe(64);
        });
    });

    describe('Config environment variable override', () => {
        it('should respect MAX_RETRIES environment variable', () => {
            process.env.MAX_RETRIES = '5';
            expect(Config.maxRetries).toBe(5);
        });

        it('should respect RETRY_MAX_WAIT environment variable', () => {
            process.env.RETRY_MAX_WAIT = '32';
            expect(Config.retryMaxWait).toBe(32);
        });

        it('should handle invalid MAX_RETRIES gracefully', () => {
            process.env.MAX_RETRIES = 'invalid';
            expect(Config.maxRetries).toBeNaN();
        });

        it('should handle invalid RETRY_MAX_WAIT gracefully', () => {
            process.env.RETRY_MAX_WAIT = 'invalid';
            expect(Config.retryMaxWait).toBeNaN();
        });

        it('should handle zero values', () => {
            process.env.MAX_RETRIES = '0';
            process.env.RETRY_MAX_WAIT = '0';
            expect(Config.maxRetries).toBe(0);
            expect(Config.retryMaxWait).toBe(0);
        });

        it('should handle negative values', () => {
            process.env.MAX_RETRIES = '-1';
            process.env.RETRY_MAX_WAIT = '-10';
            expect(Config.maxRetries).toBe(-1);
            expect(Config.retryMaxWait).toBe(-10);
        });
    });
});

describe('Exponential Backoff Calculation', () => {
    // Mock StreamingClient for testing backoff calculation
    class TestStreamingClient {
        private calculateRetryDelay(attemptNum: number): number {
            const delay = Math.min(Math.pow(2, attemptNum), Config.retryMaxWait);
            return delay * 1000; // Convert to milliseconds
        }

        getRetryDelay(attemptNum: number): number {
            return this.calculateRetryDelay(attemptNum);
        }
    }

    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        // Set defaults for tests
        delete process.env.RETRY_MAX_WAIT;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('Default max wait (64s)', () => {
        it('should calculate correct exponential delays', () => {
            const client = new TestStreamingClient();
            
            // attemptNum starts from 1 in actual implementation
            expect(client.getRetryDelay(1)).toBe(2000);  // 2^1 = 2s = 2000ms
            expect(client.getRetryDelay(2)).toBe(4000);  // 2^2 = 4s = 4000ms
            expect(client.getRetryDelay(3)).toBe(8000);  // 2^3 = 8s = 8000ms
            expect(client.getRetryDelay(4)).toBe(16000); // 2^4 = 16s = 16000ms
            expect(client.getRetryDelay(5)).toBe(32000); // 2^5 = 32s = 32000ms
            expect(client.getRetryDelay(6)).toBe(64000); // 2^6 = 64s = 64000ms (at cap)
            expect(client.getRetryDelay(7)).toBe(64000); // 2^7 = 128s, capped to 64s = 64000ms
            expect(client.getRetryDelay(10)).toBe(64000); // Still capped at 64s
        });
    });

    describe('Custom max wait', () => {
        it('should respect custom RETRY_MAX_WAIT', () => {
            process.env.RETRY_MAX_WAIT = '32';
            const client = new TestStreamingClient();
            
            expect(client.getRetryDelay(1)).toBe(2000);  // 2^1 = 2s = 2000ms
            expect(client.getRetryDelay(2)).toBe(4000);  // 2^2 = 4s = 4000ms
            expect(client.getRetryDelay(3)).toBe(8000);  // 2^3 = 8s = 8000ms
            expect(client.getRetryDelay(4)).toBe(16000); // 2^4 = 16s = 16000ms
            expect(client.getRetryDelay(5)).toBe(32000); // 2^5 = 32s = 32000ms (at cap)
            expect(client.getRetryDelay(6)).toBe(32000); // 2^6 = 64s, capped to 32s = 32000ms
        });

        it('should work with very small max wait', () => {
            process.env.RETRY_MAX_WAIT = '4';
            const client = new TestStreamingClient();
            
            expect(client.getRetryDelay(1)).toBe(2000); // 2^1 = 2s = 2000ms
            expect(client.getRetryDelay(2)).toBe(4000); // 2^2 = 4s = 4000ms (at cap)
            expect(client.getRetryDelay(3)).toBe(4000); // 2^3 = 8s, capped to 4s = 4000ms
        });
    });

    describe('Edge cases', () => {
        it('should handle attempt 0', () => {
            const client = new TestStreamingClient();
            expect(client.getRetryDelay(0)).toBe(1000); // 2^0 = 1s = 1000ms
        });

        it('should handle negative attempts', () => {
            const client = new TestStreamingClient();
            expect(client.getRetryDelay(-1)).toBe(500); // 2^-1 = 0.5s = 500ms
        });

        it('should handle zero max wait', () => {
            process.env.RETRY_MAX_WAIT = '0';
            const client = new TestStreamingClient();
            expect(client.getRetryDelay(1)).toBe(0); // Min(2^1, 0) = 0
            expect(client.getRetryDelay(10)).toBe(0); // Min(2^10, 0) = 0
        });

        it('should handle negative max wait', () => {
            process.env.RETRY_MAX_WAIT = '-10';
            const client = new TestStreamingClient();
            expect(client.getRetryDelay(1)).toBe(-10000); // Min(2^1, -10) = -10s = -10000ms
        });
    });
});

describe('Integration Behavior', () => {
    it('should provide reasonable defaults for production use', () => {
        delete process.env.MAX_RETRIES;
        delete process.env.RETRY_MAX_WAIT;
        
        expect(Config.maxRetries).toBe(3);
        expect(Config.retryMaxWait).toBe(64);
        
        // Typical retry sequence: 2s, 4s, 8s (max 3 retries)
        const delays = [];
        for (let i = 1; i <= Config.maxRetries; i++) {
            const delay = Math.min(Math.pow(2, i), Config.retryMaxWait) * 1000;
            delays.push(delay);
        }
        
        expect(delays).toEqual([2000, 4000, 8000]);
    });

    it('should allow configuration for aggressive retrying', () => {
        process.env.MAX_RETRIES = '10';
        process.env.RETRY_MAX_WAIT = '120';
        
        expect(Config.maxRetries).toBe(10);
        expect(Config.retryMaxWait).toBe(120);
        
        // Should cap at 120s, not 64s
        const delay = Math.min(Math.pow(2, 7), Config.retryMaxWait) * 1000;
        expect(delay).toBe(120000); // 120s = 120000ms, not 128s
    });

    it('should allow configuration for conservative retrying', () => {
        process.env.MAX_RETRIES = '2';
        process.env.RETRY_MAX_WAIT = '30';
        
        expect(Config.maxRetries).toBe(2);
        expect(Config.retryMaxWait).toBe(30);
        
        // Conservative sequence: 2s, 4s (max 2 retries)
        const delays = [];
        for (let i = 1; i <= Config.maxRetries; i++) {
            const delay = Math.min(Math.pow(2, i), Config.retryMaxWait) * 1000;
            delays.push(delay);
        }
        
        expect(delays).toEqual([2000, 4000]);
    });
});