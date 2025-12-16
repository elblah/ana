/**
 * Test read_file tool sandbox enforcement
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { executeReadFile, TOOL_DEFINITION } from '../src/tools/internal/read-file.js';
import { executeWriteFile } from '../src/tools/internal/write-file.js';
import { ShellUtils } from '../src/utils/shell-utils.js';
import { FileUtils } from '../src/utils/file-utils.js';
import { TestEnvironment } from './test-utils.js';

describe('read_file tool sandbox', () => {
    let tempDir: string;
    
    beforeEach(async () => {
        tempDir = await TestEnvironment.setup();
    });
    
    afterEach(async () => {
        await TestEnvironment.cleanup(tempDir);
    });

    it('should block access to parent directory', async () => {
        const result = await executeReadFile({
            path: '../',
        });

        expect(result.friendly).toContain('✗ Failed to read file:');
        expect(result.friendly).toContain('outside current directory and not allowed');
    });

    it('should block access to absolute path outside current directory', async () => {
        const result = await executeReadFile({
            path: '/etc/passwd',
        });

        expect(result.friendly).toContain('✗ Failed to read file:');
        expect(result.friendly).toContain('outside current directory and not allowed');
    });

    it('should allow access to current directory file', async () => {
        // Create a test file first using ShellUtils
        const testFile = `${tempDir}/test-read-current.txt`;
        await ShellUtils.executeCommand(`echo "test content" > ${testFile}`);
        
        const result = await executeReadFile({
            path: testFile,
        });

        expect(result.results?.content).toBe('test content\n');
        expect(result.friendly).toContain('Reading entire file');
    });

    it('should allow access to subdirectory file', async () => {
        // Create subdirectory and file
        const subdir = `${tempDir}/subdir`;
        await ShellUtils.executeCommand(`mkdir -p ${subdir}`);
        const testFile = `${subdir}/test-read-subdir.txt`;
        await ShellUtils.executeCommand(`echo "subdir content" > ${testFile}`);
        
        const result = await executeReadFile({
            path: testFile,
        });

        expect(result.results?.content).toBe('subdir content\n');
        expect(result.friendly).toContain('Reading entire file');
    });

    it('should block obvious directory traversal', async () => {
        const result = await executeReadFile({
            path: '../../../etc/passwd',
        });

        expect(result.friendly).toContain('✗ Failed to read file:');
        expect(result.friendly).toContain('outside current directory and not allowed');
    });

    it('should handle non-existent file within allowed directory', async () => {
        const result = await executeReadFile({
            path: `${tempDir}/non-existent.txt`,
        });

        expect(result.friendly).toContain('✗ Failed to read file:');
        expect(result.friendly).toContain('File not found');
    });
});