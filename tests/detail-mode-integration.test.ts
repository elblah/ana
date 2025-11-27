import { describe, it, expect, beforeEach } from 'bun:test';
import { Config } from '../src/core/config.js';

describe('Detail Mode Integration', () => {
    beforeEach(() => {
        // Reset config before each test
        Config.reset();
    });

    it('should toggle state correctly', () => {
        expect(Config.detailMode).toBe(false);

        Config.detailMode = true;
        expect(Config.detailMode).toBe(true);

        Config.detailMode = false;
        expect(Config.detailMode).toBe(false);
    });

    it('should persist state between operations', () => {
        Config.detailMode = true;
        expect(Config.detailMode).toBe(true);

        // Simulate multiple operations checking the state
        for (let i = 0; i < 10; i++) {
            expect(Config.detailMode).toBe(true);
        }

        Config.detailMode = false;
        expect(Config.detailMode).toBe(false);

        // Check persistence of disabled state
        for (let i = 0; i < 10; i++) {
            expect(Config.detailMode).toBe(false);
        }
    });
});