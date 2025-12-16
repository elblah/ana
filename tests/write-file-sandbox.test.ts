/**
 * Test write_file tool sandbox enforcement
 */

import { describe, it, expect } from 'bun:test';
import { executeWriteFile, TOOL_DEFINITION } from '../src/tools/internal/write-file.js';
import { ShellUtils } from '../src/utils/shell-utils.js';

describe('write_file tool sandbox', () => {

    it('should block access to parent directory', async () => {
        const result = await executeWriteFile({
            path: '../test-outside.txt',
            content: 'test content',
        });

        expect(result.friendly).toContain('✗ Failed to write');
        expect(result.friendly).toContain('outside current directory and not allowed');
    });

    it('should block access to absolute path outside current directory', async () => {
        const result = await executeWriteFile({
            path: '/tmp/test-write.txt',
            content: 'test content',
        });

        expect(String(result.results.error)).toContain('outside current directory and not allowed');
        expect(result.friendly).toContain('✗ Failed to write');
    });

    it('should allow writing to current directory (new file)', async () => {
        const result = await executeWriteFile({
            path: './test-write-new.txt',
            content: 'test content in current dir',
        });

        expect(result.results.error).toBeUndefined();
        expect(result.friendly).toContain('✓ Created');
        
        // Verify file was actually created
        const content = await Bun.file('test-write-new.txt').text();
        expect(content).toContain('test content in current dir');
        
        // Cleanup
        await ShellUtils.executeCommand('rm test-write-new.txt');
    });

    it('should block writing to existing file without reading first', async () => {
        // Create file first using ShellUtils
        await ShellUtils.executeCommand('echo "original content" > test-write-existing.txt');
        
        const result = await executeWriteFile({
            path: './test-write-existing.txt',
            content: 'new content',
        });

        expect(result.results.error).toContain('File exists but was not read first');
        expect(result.friendly).toContain('✗ Cannot overwrite existing file');
        
        // Cleanup
        await ShellUtils.executeCommand('rm test-write-existing.txt');
    });

    it('should allow writing to subdirectory', async () => {
        // Create test directory first using ShellUtils
        await ShellUtils.executeCommand('mkdir -p test-write-subdir');
        
        const result = await executeWriteFile({
            path: 'test-write-subdir/test.txt',
            content: 'subdir write content',
        });

        expect(result.results.error).toBeUndefined();
        expect(result.friendly).toContain('✓ Created');
        
        // Verify file was actually created
        const content = await Bun.file('test-write-subdir/test.txt').text();
        expect(content).toContain('subdir write content');
        
        // Cleanup
        await ShellUtils.executeCommand('rm -rf test-write-subdir');
    });

    it('should block obvious directory traversal', async () => {
        const result = await executeWriteFile({
            path: '../../../tmp/bad-write.txt',
            content: 'should not write here',
        });

        expect(result.results.error).toContain('outside current directory and not allowed');
        expect(result.friendly).toContain('✗ Failed to write');
    });

    it('should handle relative paths that resolve outside directory', async () => {
        const result = await executeWriteFile({
            path: '../../etc/test.txt',
            content: 'should not write here',
        });

        expect(result.results.error).toContain('outside current directory and not allowed');
        expect(result.friendly).toContain('✗ Failed to write');
    });

});