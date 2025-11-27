import { describe, it, expect, beforeEach } from 'bun:test';
import { Config } from '../src/core/config.js';
import { ToolFormatter } from '../src/core/tool-formatter.js';
import type { ToolOutput } from '../src/core/tool-formatter.js';

describe('Detail Mode Tests', () => {
    beforeEach(() => {
        // Reset config before each test
        Config.reset();
    });

    describe('formatForDisplay method respects detail mode', () => {
        it('should return friendly message when available in simple mode', () => {
            Config.detailMode = false;
            const output: ToolOutput = {
                tool: 'read_file',
                friendly: "Reading file 'test.ts'",
                important: {
                    path: 'test.ts',
                },
                detailed: {
                    line_count: 42,
                    size: '1.2KB',
                },
                results: {
                    content: 'export const test = () => {};',
                    showWhenDetailOff: true,
                },
            };

            const formatted = ToolFormatter.formatForDisplay(output);
            expect(formatted).toBe("Reading file 'test.ts'");
        });

        it('should still return friendly message in detail mode', () => {
            Config.detailMode = true;
            const output: ToolOutput = {
                tool: 'read_file',
                friendly: "Reading file 'test.ts'",
                important: {
                    path: 'test.ts',
                },
                detailed: {
                    line_count: 42,
                    size: '1.2KB',
                },
                results: {
                    content: 'export const test = () => {};',
                    showWhenDetailOff: true,
                },
            };

            const formatted = ToolFormatter.formatForDisplay(output);
            expect(formatted).toBe("Reading file 'test.ts'"); // Always shows friendly
        });

        it('should truncate long content in simple mode', () => {
            Config.detailMode = false;
            const longContent = 'x'.repeat(200);
            const output: ToolOutput = {
                tool: 'read_file',
                friendly: 'Read large file',
                important: {
                    path: 'large.txt',
                },
                results: {
                    content: longContent,
                    showWhenDetailOff: true,
                },
            };

            const formatted = ToolFormatter.formatForDisplay(output);
            expect(formatted).toBe('Read large file');
        });

        it('should still show friendly message in detail mode even with long content', () => {
            Config.detailMode = true;
            const longContent = 'x'.repeat(200);
            const output: ToolOutput = {
                tool: 'read_file',
                friendly: 'Read large file',
                important: {
                    path: 'large.txt',
                },
                results: {
                    content: longContent,
                    showWhenDetailOff: true,
                },
            };

            const formatted = ToolFormatter.formatForDisplay(output);
            expect(formatted).toBe('Read large file'); // Always shows friendly
        });
    });

    describe('Config detail mode functionality', () => {
        it('should have default state disabled', () => {
            expect(Config.detailMode).toBe(false);
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
});