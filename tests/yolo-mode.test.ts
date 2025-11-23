import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Config } from '../src/core/config.js';

describe('YOLO Mode Behavior', () => {
    let originalYoloMode: boolean;

    beforeEach(() => {
        originalYoloMode = Config.yoloMode;
    });

    afterEach(() => {
        Config.setYoloMode(originalYoloMode);
    });

    it('should toggle YOLO mode state', () => {
        Config.setYoloMode(true);
        expect(Config.yoloMode).toBe(true);

        Config.setYoloMode(false);
        expect(Config.yoloMode).toBe(false);
    });

    it('should respect YOLO_MODE environment variable', () => {
        process.env.YOLO_MODE = '1';
        expect(Config.yoloMode).toBe(true);

        process.env.YOLO_MODE = undefined;
    });

    it('should prioritize environment variable over runtime state', () => {
        process.env.YOLO_MODE = '1';
        Config.setYoloMode(false); // Set runtime state to false
        expect(Config.yoloMode).toBe(true); // But env var should take precedence

        process.env.YOLO_MODE = undefined;
        expect(Config.yoloMode).toBe(false); // Now runtime state should be used
    });
});
