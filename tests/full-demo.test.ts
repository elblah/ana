import { describe, it, expect } from 'bun:test';
import { ToolFormatter } from '../src/core/tool-formatter.js';
import type { ToolOutput } from '../src/core/tool-formatter.js';

describe('Full Demo: Tool Output Formatter', () => {
    it('should format tool output for AI consumption', () => {
        const output: ToolOutput = {
            tool: 'read_file',
            friendly: "Reading file 'src/app.ts'",
            important: {
                path: 'src/app.ts',
            },
            results: {
                content: 'export const App = () => <div>Hello World</div>;',
                showWhenDetailOff: true,
            },
        };

        const formatted = ToolFormatter.formatForAI(output);
        expect(formatted).toContain('Path: src/app.ts');
        expect(formatted).toContain('Content: export const App = () => <div>Hello World</div>;');
    });

    it('should format tool output for local display with detail off', () => {
        const output: ToolOutput = {
            tool: 'read_file',
            friendly: "Reading file 'src/app.ts'",
            important: {
                path: 'src/app.ts',
            },
            results: {
                content: 'export const App = () => <div>Hello World</div>;',
                showWhenDetailOff: true,
            },
        };

        const formatted = ToolFormatter.formatForDisplay(output);
        expect(formatted).toBe("Reading file 'src/app.ts'");
    });

    it('should format tool output for local display with detail on', () => {
        const output: ToolOutput = {
            tool: 'grep',
            friendly: 'Found 3 occurrences for "useState" in "src/hooks/"',
            important: {
                text: 'useState',
                path: 'src/hooks/',
            },
            detailed: {
                occurrences: 3,
                matches: [
                    'src/hooks/useAuth.ts:10',
                    'src/hooks/useData.ts:25',
                    'src/hooks/useUser.ts:8',
                ],
            },
            results: {
                showWhenDetailOff: true,
            },
        };

        const formatted = ToolFormatter.formatForDisplay(output);
        expect(formatted).toBe('Found 3 occurrences for "useState" in "src/hooks/"');
    });

    it('should hide results when showWhenDetailOff is false', () => {
        const output: ToolOutput = {
            tool: 'write_file',
            friendly: "Wrote 50 lines (1250 bytes) to 'dist/bundle.js'",
            important: {
                path: 'dist/bundle.js',
            },
            results: {
                content: 'File content hidden when detail mode is off',
                showWhenDetailOff: false,
            },
        };

        const formatted = ToolFormatter.formatForDisplay(output);
        expect(formatted).toBe("Wrote 50 lines (1250 bytes) to 'dist/bundle.js'");
    });

    it('should show all details for AI consumption', () => {
        const output: ToolOutput = {
            tool: 'run_shell_command',
            friendly: 'Command executed in 0.12s (exit code: 0)',
            important: {
                command: 'npm test',
            },
            detailed: {
                exit_code: 0,
                duration: '0.12s',
            },
            results: {
                stdout: 'PASS tests',
                stderr: '',
                showWhenDetailOff: false,
            },
        };

        const formatted = ToolFormatter.formatForAI(output);
        expect(formatted).toContain('Command: npm test');
        expect(formatted).toContain('Exit code: 0');
        expect(formatted).toContain('Duration: 0.12s');
        expect(formatted).toContain('Stdout: PASS tests');
    });

    it('should handle errors gracefully', () => {
        const output: ToolOutput = {
            tool: 'read_file',
            friendly: 'Failed to read file: Permission denied',
            important: {
                path: '/etc/shadow',
            },
            results: {
                error: 'Permission denied',
                showWhenDetailOff: true,
            },
        };

        const formatted = ToolFormatter.formatForAI(output);
        expect(formatted).toContain('Path: /etc/shadow');
        expect(formatted).toContain('Error: Permission denied');
    });

    it('should handle empty results', () => {
        const output: ToolOutput = {
            tool: 'run_shell_command',
            friendly: 'Command executed in 0.01s (exit code: 0)',
            important: {
                command: 'ls',
            },
            results: {
                showWhenDetailOff: true,
            },
        };

        const formatted = ToolFormatter.formatForDisplay(output);
        expect(formatted).toBe('Command executed in 0.01s (exit code: 0)');
    });

    it('should format edit file operations', () => {
        const output: ToolOutput = {
            tool: 'edit_file',
            friendly: "Updated 'package.json' (15 → 20 chars)",
            important: {
                path: 'package.json',
            },
            detailed: {
                operation: 'replace',
                old_string_length: 15,
                new_string_length: 20,
            },
        };

        const formatted = ToolFormatter.formatForAI(output);
        expect(formatted).toContain('Path: package.json');
        expect(formatted).toContain('Old string length: 15');
        expect(formatted).toContain('New string length: 20');
    });

    it('should handle nested detailed information', () => {
        const output: ToolOutput = {
            tool: 'edit_file',
            friendly: "Updated 'test.ts' (10 → 15 chars)",
            important: {
                path: 'test.ts',
            },
            detailed: {
                operation: {
                    type: 'replace',
                    timestamp: '2024-01-01T12:00:00Z',
                },
                metadata: {
                    old_length: 10,
                    new_length: 15,
                },
            },
        };

        const formatted = ToolFormatter.formatForDisplay(output);
        expect(formatted).toBe("Updated 'test.ts' (10 → 15 chars)");
    });

    it('should handle array results with proper formatting', () => {
        const longArray = Array.from({ length: 100 }, (_, i) => `item-${i}`);
        const output: ToolOutput = {
            tool: 'list_directory',
            friendly: 'Listed directory contents',
            important: {
                path: '.',
            },
            results: {
                files: longArray,
                count: longArray.length,
                showWhenDetailOff: true,
            },
        };

        const formatted = ToolFormatter.formatForAI(output);
        expect(formatted).toContain('Files:');
        expect(formatted).toContain('item-0');
    });

    it('should handle object results with proper formatting', () => {
        const output: ToolOutput = {
            tool: 'custom_tool',
            friendly: 'Custom operation completed',
            results: {
                data: {
                    key1: 'value1',
                    key2: 'value2',
                },
                showWhenDetailOff: true,
            },
        };

        const formatted = ToolFormatter.formatForAI(output);
        expect(formatted).toContain('Data:');
        expect(formatted).toContain('{"key1":"value1","key2":"value2"}');
    });
});
