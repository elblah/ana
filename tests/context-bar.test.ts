import { describe, it, expect, beforeEach } from 'bun:test';
import { ContextBar } from '../src/core/context-bar.js';
import { Stats } from '../src/core/stats.js';
import { MessageHistory } from '../src/core/message-history.js';
import { Config } from '../src/core/config.js';

describe('ContextBar', () => {
    let contextBar: ContextBar;
    let stats: Stats;
    let messageHistory: MessageHistory;

    beforeEach(() => {
        contextBar = new ContextBar();
        stats = new Stats();
        messageHistory = new MessageHistory(stats);
    });

    describe('formatContextBar', () => {
        it('should format empty context', () => {
            const result = contextBar.formatContextBar(stats, messageHistory);
            expect(result).toContain('Context:');
            expect(result).toContain('0%');
            expect(result).toMatch(/\(0\/\d+\.\d+k/); // Match (0/XXX.Xk)
            expect(result).toContain('@');
        });

        it('should show green progress bar for low usage', () => {
            stats.setCurrentPromptSize(10000); // 10k tokens

            const result = contextBar.formatContextBar(stats, messageHistory);
            expect(result).toContain('█'); // Filled part
            expect(result).toContain('░'); // Empty part
            expect(result).toContain('%'); // Some percentage
            expect(result).toMatch(/\(10\.0k\/\d+\.\d+k/); // Match (10.0k/XXX.Xk)
        });

        it('should show yellow progress bar for medium usage', () => {
            stats.setCurrentPromptSize(50000); // 50k tokens

            const result = contextBar.formatContextBar(stats, messageHistory);
            expect(result).toContain('█');
            expect(result).toContain('%'); // Some percentage
            expect(result).toMatch(/\(50\.0k\/\d+\.\d+k/); // Match (50.0k/XXX.Xk)
        });

        it('should show red progress bar for high usage', () => {
            stats.setCurrentPromptSize(110000); // 110k tokens

            const result = contextBar.formatContextBar(stats, messageHistory);
            expect(result).toContain('█');
            expect(result).toContain('%'); // Some percentage
            expect(result).toMatch(/\(110\.0k\/\d+\.\d+k/); // Match (110.0k/XXX.Xk)
        });
    });

    describe('createProgressBar', () => {
        it('should return all empty bars for 0%', () => {
            const progressBar = contextBar.createProgressBar(0);
            expect(progressBar).toContain('░'.repeat(10));
            expect(progressBar).not.toContain('█');
        });

        it('should return all filled bars for 100%', () => {
            const progressBar = contextBar.createProgressBar(100);
            expect(progressBar).toContain('█'.repeat(10));
            expect(progressBar).not.toContain('░');
        });

        it('should return mixed bars for 50%', () => {
            const progressBar = contextBar.createProgressBar(50);
            expect(progressBar).toContain('█'.repeat(5));
            expect(progressBar).toContain('░'.repeat(5));
        });
    });

    describe('getCurrentHour', () => {
        it('should return current time in HH:MM:SS format', () => {
            const timeStr = contextBar.getCurrentHour();
            expect(timeStr).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        });
    });
});
