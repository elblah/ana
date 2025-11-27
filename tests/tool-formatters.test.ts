/**
 * Tests for custom tool argument formatters
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ToolManager } from '../src/core/tool-manager.js';
import { Stats } from '../src/core/stats.js';

describe('Tool Argument Formatters', () => {
    let toolManager: ToolManager;
    let stats: Stats;

    beforeEach(() => {
        stats = new Stats();
        toolManager = new ToolManager(stats);
    });

    describe('run_shell_command formatter', () => {
        it('should format basic command', () => {
            const args = { command: 'ls -la' };
            const formatted = toolManager.formatToolArguments('run_shell_command', args);

            expect(formatted).toBe('Command: ls -la');
        });

        it('should format command with reason and timeout', () => {
            const args = {
                command: 'npm install',
                reason: 'Installing project dependencies',
                timeout: 60,
            };
            const formatted = toolManager.formatToolArguments('run_shell_command', args);

            expect(formatted).toBe(
                'Command: npm install\nReason: Installing project dependencies\nTimeout: 60s'
            );
        });

        it('should format command with reason only', () => {
            const args = {
                command: 'git status',
                reason: 'Check git status',
            };
            const formatted = toolManager.formatToolArguments('run_shell_command', args);

            expect(formatted).toBe('Command: git status\nReason: Check git status');
        });

        it('should format command with non-default timeout', () => {
            const args = {
                command: 'docker build -t app .',
                timeout: 120,
            };
            const formatted = toolManager.formatToolArguments('run_shell_command', args);

            expect(formatted).toBe('Command: docker build -t app .\nTimeout: 120s');
        });

        it('should not show default timeout', () => {
            const args = {
                command: 'echo "hello"',
            };
            const formatted = toolManager.formatToolArguments('run_shell_command', args);

            expect(formatted).toBe('Command: echo "hello"');
        });
    });

    describe('read_file formatter', () => {
        it('should format basic path', () => {
            const args = { path: 'src/index.ts' };
            const formatted = toolManager.formatToolArguments('read_file', args);

            expect(formatted).toBe('Path: src/index.ts');
        });

        it('should format with offset', () => {
            const args = { path: 'src/index.ts', offset: 100 };
            const formatted = toolManager.formatToolArguments('read_file', args);

            expect(formatted).toBe('Path: src/index.ts\n  Offset: 100');
        });

        it('should format with limit', () => {
            const args = { path: 'src/index.ts', limit: 50 };
            const formatted = toolManager.formatToolArguments('read_file', args);

            expect(formatted).toBe('Path: src/index.ts\n  Limit: 50');
        });

        it('should format with offset and limit', () => {
            const args = { path: 'src/index.ts', offset: 100, limit: 50 };
            const formatted = toolManager.formatToolArguments('read_file', args);

            expect(formatted).toBe('Path: src/index.ts\n  Offset: 100\n  Limit: 50');
        });

        it('should not show default offset and limit', () => {
            const args = { path: 'src/index.ts', offset: 0, limit: 2000 };
            const formatted = toolManager.formatToolArguments('read_file', args);

            expect(formatted).toBe('Path: src/index.ts');
        });
    });

    describe('write_file formatter', () => {
        it('should format short content', () => {
            const args = {
                path: 'test.txt',
                content: 'Hello, World!',
            };
            const formatted = toolManager.formatToolArguments('write_file', args);

            expect(formatted).toBe('Path: test.txt\n  Content: Hello, World!');
        });

        it('should truncate long content', () => {
            const longContent = 'a'.repeat(150);
            const args = {
                path: 'test.txt',
                content: longContent,
            };
            const formatted = toolManager.formatToolArguments('write_file', args);

            expect(formatted).toBe(
                `Path: test.txt\n  Content: ${'a'.repeat(100)}... (${longContent.length} chars total)`
            );
        });
    });

    describe('edit_file formatter', () => {
        it('should format replacement', () => {
            const args = {
                path: 'test.txt',
                old_string: 'old text',
                new_string: 'new text',
            };
            const formatted = toolManager.formatToolArguments('edit_file', args);

            expect(formatted).toBe('Path: test.txt\n  Old: old text\n  New: new text');
        });

        it('should format deletion', () => {
            const args = {
                path: 'test.txt',
                old_string: 'delete me',
                new_string: '',
            };
            const formatted = toolManager.formatToolArguments('edit_file', args);

            expect(formatted).toBe(
                'Path: test.txt\n  Old: delete me\n  New: [empty - deleting text]'
            );
        });

        it('should format insertion', () => {
            const args = {
                path: 'test.txt',
                old_string: '',
                new_string: 'insert this',
            };
            const formatted = toolManager.formatToolArguments('edit_file', args);

            expect(formatted).toBe(
                'Path: test.txt\n  Old: [empty - inserting text]\n  New: insert this'
            );
        });

        it('should truncate long strings', () => {
            const longString = 'a'.repeat(100);
            const args = {
                path: 'test.txt',
                old_string: longString,
                new_string: longString,
            };
            const formatted = toolManager.formatToolArguments('edit_file', args);

            const truncated = `${'a'.repeat(50)}... [hidden]`;
            expect(formatted).toBe(`Path: test.txt\n  Old: ${truncated}\n  New: ${truncated}`);
        });
    });

    describe('grep formatter', () => {
        it('should format basic search', () => {
            const args = { text: 'function' };
            const formatted = toolManager.formatToolArguments('grep', args);

            expect(formatted).toBe('Text: "function"');
        });

        it('should format with path', () => {
            const args = {
                text: 'async',
                path: 'src/',
            };
            const formatted = toolManager.formatToolArguments('grep', args);

            expect(formatted).toBe('Text: "async"\n  Path: src/');
        });

        it('should format with max results', () => {
            const args = {
                text: 'import',
                max_results: 100,
            };
            const formatted = toolManager.formatToolArguments('grep', args);

            expect(formatted).toBe('Text: "import"\n  Max results: 100');
        });

        it('should format with context', () => {
            const args = {
                text: 'export',
                context: 5,
            };
            const formatted = toolManager.formatToolArguments('grep', args);

            expect(formatted).toBe('Text: "export"\n  Context: 5 lines');
        });

        it('should format with all options', () => {
            const args = {
                text: 'class',
                path: 'src/',
                max_results: 500,
                context: 3,
            };
            const formatted = toolManager.formatToolArguments('grep', args);

            expect(formatted).toBe(
                'Text: "class"\n  Path: src/\n  Max results: 500\n  Context: 3 lines'
            );
        });

        it('should not show default values', () => {
            const args = {
                text: 'test',
                path: '.',
                max_results: 2000,
                context: 2,
            };
            const formatted = toolManager.formatToolArguments('grep', args);

            expect(formatted).toBe('Text: "test"');
        });
    });

    describe('list_directory formatter', () => {
        it('should format path', () => {
            const args = { path: 'src/' };
            const formatted = toolManager.formatToolArguments('list_directory', args);

            expect(formatted).toBe('Listing directory: src/');
        });

        it('should use default for empty path', () => {
            const args = {};
            const formatted = toolManager.formatToolArguments('list_directory', args);

            expect(formatted).toBe('Listing current directory');
        });
    });

    describe('fallback to JSON', () => {
        it('should fall back to JSON for tools without formatter', () => {
            const args = { name: 'test', value: 123 };
            const formatted = toolManager.formatToolArguments('non_existent_tool', args);

            expect(formatted).toBe(JSON.stringify(args, null, 2));
        });

        it('should handle string arguments', () => {
            const args = '{"command": "ls", "timeout": 30}';
            const formatted = toolManager.formatToolArguments('run_shell_command', args);

            expect(formatted).toBe('Command: ls');
        });

        it('should handle invalid JSON gracefully', () => {
            const args = 'invalid json';
            const formatted = toolManager.formatToolArguments('non_existent_tool', args);

            expect(formatted).toBe('invalid json');
        });
    });
});
