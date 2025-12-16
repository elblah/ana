/**
 * CRITICAL SAFETY TESTS: write_file read-before-write enforcement
 * 
 * These tests simulate ACTUAL user workflow to ensure safety works end-to-end
 * - Preview generation must fail if file not read
 * - No diff should be shown  
 * - No approval should be requested
 * - Operation must be blocked completely
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { executeWriteFile, TOOL_DEFINITION } from '../src/tools/internal/write-file.js';
import { executeReadFile } from '../src/tools/internal/read-file.js';
import { ShellUtils } from '../src/utils/shell-utils.js';
import { FileUtils } from '../src/utils/file-utils.js';
import { TestEnvironment } from './test-utils.js';

describe('write_file CRITICAL SAFETY - End-to-End Integration', () => {
    let tempDir: string;
    
    beforeEach(async () => {
        tempDir = await TestEnvironment.setup();
    });
    
    afterEach(async () => {
        await TestEnvironment.cleanup(tempDir);
    });

    it('MUST BLOCK: Preview generation when existing file not read first', async () => {
        // Create a test file
        const testFile = `${tempDir}/test-write-safety.txt`;
        await ShellUtils.executeCommand(`echo "original content" > ${testFile}`);
        
        // Try to generate preview WITHOUT reading file first
        const preview = await TOOL_DEFINITION.generatePreview({
            path: testFile,
            content: 'modified content',
        });

        // CRITICAL: Preview must be blocked completely
        expect(preview.canApprove).toBe(false);
        expect(preview.warning).toContain('File must be read first');
        expect(preview.content).toContain('exists but wasn\'t read first');
        
        // CRITICAL: No diff should be generated
        expect(preview.content).not.toContain('---');
        expect(preview.content).not.toContain('+++');
        expect(preview.content).not.toContain('original content');
        expect(preview.content).not.toContain('modified content');
    });

    it('MUST BLOCK: Execution when existing file not read first', async () => {
        // Create a test file
        const testFile = `${tempDir}/test-write-exec.txt`;
        await ShellUtils.executeCommand(`echo "original content" > ${testFile}`);
        
        // Try to execute write WITHOUT reading file first
        const result = await executeWriteFile({
            path: testFile,
            content: 'modified content',
        });

        // CRITICAL: Operation must fail with safety warning
        expect(result.tool).toBe('write_file');
        expect(result.friendly).toContain('Cannot overwrite existing file');
        expect(result.friendly).toContain('✗');
        expect(result.results?.success).toBeUndefined();
        
        // CRITICAL: File must remain unchanged
        const content = await Bun.file(testFile).text();
        expect(content).toBe('original content\n');
    });

    it('REGRESSION TEST: Both preview AND execution must be blocked', async () => {
        // Create a test file
        const testFile = `${tempDir}/test-regression.txt`;
        await ShellUtils.executeCommand(`echo "original" > ${testFile}`);
        
        // Preview should be blocked
        const preview = await TOOL_DEFINITION.generatePreview({
            path: testFile,
            content: 'modified',
        });
        expect(preview.canApprove).toBe(false);
        
        // Execution should also be blocked
        const result = await executeWriteFile({
            path: testFile,
            content: 'modified',
        });
        expect(result.results?.success).toBeUndefined();
    });

    it('MUST ALLOW: Preview when file was read first', async () => {
        // Create a test file
        const testFile = `${tempDir}/test-write-ok.txt`;
        await ShellUtils.executeCommand(`echo "original content" > ${testFile}`);
        
        // Read file first using read_file tool to track it
        await executeReadFile({ path: testFile });
        
        // Now try to generate preview
        const preview = await TOOL_DEFINITION.generatePreview({
            path: testFile,
            content: 'modified content',
        });

        // CRITICAL: Preview should work normally
        expect(preview.canApprove).toBe(true);
        expect(preview.warning).toBeUndefined();
        expect(preview.content).toContain('---');
        expect(preview.content).toContain('+++');
        expect(preview.content).toContain('original content');
        expect(preview.content).toContain('modified content');
    });

    it('MUST ALLOW: Execution when file was read first', async () => {
        // Create a test file
        const testFile = `${tempDir}/test-write-exec-ok.txt`;
        await ShellUtils.executeCommand(`echo "original content" > ${testFile}`);
        
        // Read file first using read_file tool to track it
        await executeReadFile({ path: testFile });
        
        // Now try to execute write
        const result = await executeWriteFile({
            path: testFile,
            content: 'modified content',
        });

        // CRITICAL: Operation should succeed
        expect(result.tool).toBe('write_file');
        expect(result.results.success).toBe(true);
        expect(result.friendly).toContain('✓');
        
        // CRITICAL: File should be modified
        const content = await Bun.file(testFile).text();
        expect(content).toBe('modified content');
    });

    it('MUST ALLOW: New file creation without reading', async () => {
        // Try to create new file without reading first
        const testFile = `${tempDir}/test-write-new.txt`;
        const preview = await TOOL_DEFINITION.generatePreview({
            path: testFile,
            content: 'new file content',
        });

        // Should work normally for new files
        expect(preview.canApprove).toBe(true);
        expect(preview.warning).toBeUndefined();
        expect(preview.content).toContain('new file content');
    });
});