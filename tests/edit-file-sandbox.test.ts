/**
 * Test edit_file tool sandbox enforcement
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { executeEditFile, TOOL_DEFINITION } from '../src/tools/internal/edit-file.js';
import { executeReadFile } from '../src/tools/internal/read-file.js';
import { ShellUtils } from '../src/utils/shell-utils.js';
import { FileUtils } from '../src/utils/file-utils.js';
import { TestEnvironment } from './test-utils.js';

describe('edit_file tool sandbox', () => {
    let tempDir: string;
    
    beforeEach(async () => {
        tempDir = await TestEnvironment.setup();
    });
    
    afterEach(async () => {
        await TestEnvironment.cleanup(tempDir);
    });

    it('should block access to parent directory', async () => {
        const result = await executeEditFile({
            path: '../test-edit-outside.txt',
            old_string: '',
            new_string: 'test content',
        });

        expect(String(result.results.error)).toContain('outside current directory and not allowed');
    });

    it('should block access to absolute path outside current directory', async () => {
        const result = await executeEditFile({
            path: '/tmp/test-edit.txt',
            old_string: '',
            new_string: 'test content',
        });

        expect(String(result.results.error)).toContain('outside current directory and not allowed');
    });

    it('should allow editing file in current directory after reading', async () => {
        // Create and read a test file
        const testFile = `${tempDir}/test-edit-current.txt`;
        await ShellUtils.executeCommand(`echo "original content" > ${testFile}`);
        await executeReadFile({ path: testFile });
        
        const result = await executeEditFile({
            path: testFile,
            old_string: 'original content',
            new_string: 'modified content',
        });

        expect(result.results?.success).toBe(true);
        expect(result.friendly).toContain('Updated');
        expect(result.friendly).toContain('16 chars');
    });

    it('should allow creating new file in subdirectory', async () => {
        // Create subdirectory
        const subdir = `${tempDir}/subdir`;
        await ShellUtils.executeCommand(`mkdir -p ${subdir}`);
        const testFile = `${subdir}/test-edit-subdir.txt`;
        
        const result = await executeEditFile({
            path: testFile,
            old_string: '',
            new_string: 'new file content',
        });

        expect(result.results?.success).toBe(true);
        expect(result.friendly).toContain('Created new file');
        expect(result.friendly).toContain('16 characters');
    });

    it('should block obvious directory traversal', async () => {
        const result = await executeEditFile({
            path: '../../../etc/passwd',
            old_string: '',
            new_string: 'malicious content',
        });

        expect(String(result.results.error)).toContain('outside current directory and not allowed');
    });

    it('should handle editing non-existent file within allowed directory', async () => {
        const testFile = `${tempDir}/test-nonexistent.txt`;
        
        const result = await executeEditFile({
            path: testFile,
            old_string: 'old content',
            new_string: 'new content',
        });

        expect(result.results?.success).toBeUndefined();
        expect(String(result.results?.error)).toContain('Must read file first');
    });
});