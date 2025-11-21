import { describe, it, expect } from 'bun:test';
import { ToolFormatter } from '../src/core/tool-formatter.js';
import type { ToolOutput } from '../src/core/tool-formatter.js';

describe('Detail Mode Tests', () => {
  describe('formatForDisplay method', () => {
    it('should return friendly message when available', () => {
      const output: ToolOutput = {
        tool: 'read_file',
        friendly: 'Reading file \'test.ts\'',
        important: {
          path: 'test.ts'
        },
        detailed: {
          line_count: 42,
          size: '1.2KB'
        },
        results: {
          content: 'export const test = () => {};',
          showWhenDetailOff: true
        }
      };

      const formatted = ToolFormatter.formatForDisplay(output);
      expect(formatted).toBe('Reading file \'test.ts\'');
    });

    it('should return null when no friendly message', () => {
      const output: ToolOutput = {
        tool: 'run_shell_command',
        important: {
          command: 'ls -la'
        },
        results: {
          stdout: 'file1.txt\nfile2.txt',
          stderr: '',
          showWhenDetailOff: false
        }
      };

      const formatted = ToolFormatter.formatForDisplay(output);
      expect(formatted).toBeNull();
    });

    it('should handle errors correctly', () => {
      const output: ToolOutput = {
        tool: 'read_file',
        friendly: 'Failed to read file: Permission denied',
        important: {
          path: '/root/.bashrc'
        },
        results: {
          error: 'Permission denied',
          showWhenDetailOff: true
        }
      };

      const formatted = ToolFormatter.formatForDisplay(output);
      expect(formatted).toBe('Failed to read file: Permission denied');
    });
  });

  describe('formatForAI method should always return full output', () => {
    it('should include all important data', () => {
      const output: ToolOutput = {
        tool: 'read_file',
        friendly: 'Reading file \'test.ts\'',
        important: {
          path: 'test.ts'
        },
        detailed: {
          line_count: 42
        },
        results: {
          content: 'export const test = () => {};',
          showWhenDetailOff: false
        }
      };

      const aiFormatted = ToolFormatter.formatForAI(output);
      
      // Should always show everything for AI
      expect(aiFormatted).toContain('Path: test.ts');
      expect(aiFormatted).toContain('Line count: 42');
      expect(aiFormatted).toContain('Content: export const test = () => {};');
    });

    it('should include all results even when showWhenDetailOff is false', () => {
      const output: ToolOutput = {
        tool: 'run_shell_command',
        friendly: 'Command executed successfully',
        important: {
          command: 'ls -la'
        },
        results: {
          stdout: 'file1.txt\nfile2.txt',
          stderr: '',
          showWhenDetailOff: false
        }
      };

      const aiFormatted = ToolFormatter.formatForAI(output);
      
      // Should show everything
      expect(aiFormatted).toContain('Command: ls -la');
      expect(aiFormatted).toContain('Stdout: file1.txt\nfile2.txt');
    });

    it('should handle null and undefined values', () => {
      const output: ToolOutput = {
        tool: 'custom_tool',
        friendly: 'Custom operation completed',
        important: {
          path: 'test.txt',
          value: null,
          optional: undefined
        },
        detailed: {},
        results: {
          showWhenDetailOff: true
        }
      };

      const aiFormatted = ToolFormatter.formatForAI(output);
      expect(aiFormatted).toContain('Path: test.txt');
      expect(aiFormatted).toContain('Value: null');
      expect(aiFormatted).toContain('Optional: null');
    });

    it('should format arrays and objects using JSON.stringify', () => {
      const output: ToolOutput = {
        tool: 'list_directory',
        friendly: 'Listed directory',
        important: {
          path: '.'
        },
        results: {
          files: ['file1.txt', 'file2.txt'],
          metadata: {
            count: 2,
            total_size: '1KB'
          },
          showWhenDetailOff: true
        }
      };

      const aiFormatted = ToolFormatter.formatForAI(output);
      expect(aiFormatted).toContain('Path: .');
      expect(aiFormatted).toContain('Files: ["file1.txt","file2.txt"]');
      expect(aiFormatted).toContain('Metadata: {"count":2,"total_size":"1KB"}');
    });

    it('should handle very long content without truncation for AI', () => {
      const longContent = 'x'.repeat(200);
      const output: ToolOutput = {
        tool: 'read_file',
        friendly: 'Read large file',
        important: {
          path: 'large.txt'
        },
        results: {
          content: longContent,
          showWhenDetailOff: true
        }
      };

      const aiFormatted = ToolFormatter.formatForAI(output);
      expect(aiFormatted).toContain('Path: large.txt');
      // AI format should include the full content without truncation
      expect(aiFormatted).toContain('Content: ' + longContent);
      
      // Display format returns the friendly message
      const displayFormatted = ToolFormatter.formatForDisplay(output);
      expect(displayFormatted).toBe('Read large file');
    });

    it('should format nested objects using JSON.stringify', () => {
      const output: ToolOutput = {
        tool: 'edit_file',
        friendly: 'Updated \'test.ts\'',
        important: {
          path: 'test.ts'
        },
        detailed: {
          operation: {
            type: 'replace',
            timestamp: '2024-01-01T12:00:00Z'
          },
          metadata: {
            old_length: 10,
            new_length: 15
          }
        }
      };

      const aiFormatted = ToolFormatter.formatForAI(output);
      expect(aiFormatted).toContain('Path: test.ts');
      expect(aiFormatted).toContain('Operation: {"type":"replace","timestamp":"2024-01-01T12:00:00Z"}');
      expect(aiFormatted).toContain('Metadata: {"old_length":10,"new_length":15}');
    });

    it('should add empty line before content when other fields exist', () => {
      const output: ToolOutput = {
        tool: 'read_file',
        friendly: 'Reading file',
        important: {
          path: 'test.txt'
        },
        results: {
          content: 'File content here',
          showWhenDetailOff: true
        }
      };

      const aiFormatted = ToolFormatter.formatForAI(output);
      const lines = aiFormatted.split('\n');
      
      // Should have important field, empty line, then content
      expect(lines[0]).toBe('  Path: test.txt');
      expect(lines[1]).toBe('  Content: File content here');
      expect(lines[2]).toBe('');
      expect(lines[3]).toBe('File content here');
    });
  });
});