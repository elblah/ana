/**
 * Test list_directory tool sandbox enforcement
 */

import { describe, it, expect } from 'bun:test';
import { executeListDirectory, TOOL_DEFINITION } from '../src/tools/internal/list-directory.js';
import { ShellUtils } from '../src/utils/shell-utils.js';

describe('list_directory tool sandbox', () => {

    it('should block access to parent directory', async () => {
        const result = await executeListDirectory({
            path: '../',
        });

        expect(result.friendly).toContain('Access denied:');
        expect(result.friendly).toContain('outside current directory');
    });

    it('should block access to absolute path outside current directory', async () => {
        const result = await executeListDirectory({
            path: '/etc',
        });

        expect(String(result.results.error)).toContain('Access denied');
        expect(result.friendly).toContain('Access denied:');
    });

    it('should allow listing current directory', async () => {
        const result = await executeListDirectory({
            path: '.',
        });

        expect(result.results.error).toBeUndefined();
        expect(result.friendly).toContain('Found');
        // list_directory returns a ToolOutput with results.files containing a string
        expect(typeof result.results.files).toBe('string');
    });

    it('should allow listing subdirectory', async () => {
        // Create test directory first using ShellUtils
        await ShellUtils.executeCommand('mkdir -p test-list-subdir');
        await ShellUtils.executeCommand('echo "content" > test-list-subdir/test.txt');
        
        const result = await executeListDirectory({
            path: 'test-list-subdir',
        });

        expect(result.results.error).toBeUndefined();
        expect(result.friendly).toContain('Found');
        expect(typeof result.results.files).toBe('string');
        
        // Cleanup
        await ShellUtils.executeCommand('rm -rf test-list-subdir');
    });

    it('should block obvious directory traversal', async () => {
        const result = await executeListDirectory({
            path: '../../../etc',
        });

        expect(result.results.error).toContain('Access denied');
        expect(result.friendly).toContain('Access denied:');
    });

    it('should handle non-existent directory within allowed path', async () => {
        const result = await executeListDirectory({
            path: 'non-existent-directory',
        });

        expect(result.results.error).toContain('Directory not found');
        expect(result.friendly).toContain('Directory not found:');
    });

    it('should allow listing with default (empty) path parameter', async () => {
        const result = await executeListDirectory({});

        expect(result.results.error).toBeUndefined();
        expect(result.friendly).toContain('Found');
        expect(typeof result.results.files).toBe('string');
    });

});