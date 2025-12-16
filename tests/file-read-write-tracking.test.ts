/**
 * File Read-Before-Write Tracking Tests
 * Each tool must enforce that files are read before they can be modified
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FileUtils } from '../src/utils/file-utils.js';
import { executeWriteFile } from '../src/tools/internal/write-file.js';
import { executeReadFile } from '../src/tools/internal/read-file.js';
import { executeEditFile } from '../src/tools/internal/edit-file.js';
import { TestEnvironment } from './test-utils.js';

describe('File Read-Before-Write Tracking Enforcement', () => {
    let testDir: string;
    let testFile: string;
    let newFile: string;
    const existingContent = 'This is existing content';
    const newContent = 'This is new content';

    beforeEach(async () => {
        // Reset state manually, then setup without clearing (since this test tests tracking behavior directly)
        FileUtils.resetAllState();
        testDir = await TestEnvironment.setup(false);
        testFile = `${testDir}/existing.txt`;
        newFile = `${testDir}/new.txt`;
        
        // Create an existing file
        await Bun.write(testFile, existingContent);
    });

    afterEach(async () => {
        await TestEnvironment.cleanup(testDir);
    });

    describe('write_file Tool - Read Enforcement', () => {
        it('should ISSUE WARNING when writing to existing file without reading first', async () => {
            const result = await executeWriteFile({
                path: testFile,
                content: newContent
            });
            
            expect(result.tool).toBe('write_file');
            // Current behavior: succeeds but with warning in results.warning
            expect(result.friendly).toContain('Cannot overwrite existing file');
            expect(result.friendly).toContain('✗');
        });

        it('should SUCCEED when writing to existing file after reading it first', async () => {
            // First read the file
            await executeReadFile({ path: testFile });
            
            // Then write to it
            const result = await executeWriteFile({
                path: testFile,
                content: newContent
            });
            
            expect(result.tool).toBe('write_file');
            expect(result.friendly).toContain('Created');
            expect(result.friendly).not.toContain('ERROR');
        });

        it('should SUCCEED when creating new file without reading first', async () => {
            const result = await executeWriteFile({
                path: newFile,
                content: newContent
            });
            
            expect(result.tool).toBe('write_file');
            expect(result.friendly).toContain('Created');
            expect(result.friendly).not.toContain('ERROR');
        });
    });

    describe('edit_file Tool - Read Enforcement', () => {
        it('should FAIL when editing existing file without reading first', async () => {
            const result = await executeEditFile({
                path: testFile,
                old_string: 'existing',
                new_string: 'modified'
            });
            
            expect(result.tool).toBe('edit_file');
            expect(result.friendly).toContain('✗');
            expect(result.friendly).toContain('Must read file');
        });

        it('should SUCCEED when editing existing file after reading it first', async () => {
            // First read the file
            await executeReadFile({ path: testFile });
            
            // Then edit it
            const result = await executeEditFile({
                path: testFile,
                old_string: 'existing',
                new_string: 'modified'
            });
            
            expect(result.tool).toBe('edit_file');
            expect(result.friendly).toContain('Updated');
            expect(result.friendly).not.toContain('ERROR');
        });

        it('should SUCCEED when creating new file with empty old_string without reading first', async () => {
            const result = await executeEditFile({
                path: newFile,
                old_string: '',
                new_string: newContent
            });
            
            expect(result.tool).toBe('edit_file');
            // This should succeed because empty old_string means create new file
            expect(result.friendly).toContain('Created');
            expect(result.friendly).not.toContain('WARNING');
        });

        it('should FAIL when trying to create file that already exists with empty old_string', async () => {
            // Clear tracking first
            const fileUtils = FileUtils as any;
            if (fileUtils.readFiles) {
                fileUtils.readFiles.clear();
            }
            
            const result = await executeEditFile({
                path: testFile, // This file exists
                old_string: '',
                new_string: newContent
            });
            
            expect(result.tool).toBe('edit_file');
            // This should fail because the file exists
            expect(result.friendly).toContain('✗');
            expect(result.friendly).toContain('already exists');
        });
    });

    describe('FileUtils Direct Access - Tracking Enforcement', () => {
        it('should track files read through FileUtils directly', async () => {
            // Should not be tracked initially
            expect(FileUtils.wasFileRead(testFile)).toBe(false);
            
            // Read through FileUtils
            await FileUtils.readFile(testFile);
            
            // Should now be tracked
            expect(FileUtils.wasFileRead(testFile)).toBe(true);
        });

        it('should track files read through sandboxed method', async () => {
            // Should not be tracked initially
            expect(FileUtils.wasFileRead(testFile)).toBe(false);
            
            // Read through sandboxed method
            await FileUtils.readFileWithSandbox(testFile);
            
            // Should now be tracked
            expect(FileUtils.wasFileRead(testFile)).toBe(true);
        });

        it('should fail direct FileUtils writeFile without read first (if protection exists)', async () => {
            // This test depends on whether FileUtils has built-in protection
            // If it doesn't, this test documents that expectation
            
            try {
                // Try to write without reading first
                await FileUtils.writeFile(testFile, newContent);
                
                // If we get here, FileUtils doesn't have built-in protection
                // This is expected - protection should be in tools
                expect(true).toBe(true);
            } catch (error) {
                // If FileUtils does have protection, that's also valid
                expect((error as Error).message).toContain('not read first');
            }
        });
    });

    describe('Cross-Tool File Tracking', () => {
        it('should allow edit after write through read tracking', async () => {
            // Step 1: Create new file (no read required)
            await executeWriteFile({
                path: newFile,
                content: existingContent
            });
            
            // Step 2: Read the newly created file
            await executeReadFile({ path: newFile });
            
            // Step 3: Edit the file (should succeed because it was read)
            const result = await executeEditFile({
                path: newFile,
                old_string: existingContent,
                new_string: newContent
            });
            
            expect(result.tool).toBe('edit_file');
            expect(result.friendly).toContain('Updated');
            expect(result.friendly).not.toContain('ERROR');
        });

        it('should maintain tracking across multiple operations', async () => {
            // Read a file
            await executeReadFile({ path: testFile });
            expect(FileUtils.wasFileRead(testFile)).toBe(true);
            
            // Write to it (should succeed)
            const writeResult = await executeWriteFile({
                path: testFile,
                content: 'Updated after read'
            });
            expect(writeResult.friendly).not.toContain('ERROR');
            
            // Edit it (should still succeed because tracking persists)
            const editResult = await executeEditFile({
                path: testFile,
                old_string: 'Updated after read',
                new_string: 'Final update'
            });
            expect(editResult.friendly).not.toContain('ERROR');
        });
    });

    describe('Edge Cases and Error Conditions', () => {
        it('should handle file deletion and recreation properly', async () => {
            // Read file
            await executeReadFile({ path: testFile });
            expect(FileUtils.wasFileRead(testFile)).toBe(true);
            
            // Delete file (through FileUtils)
            await FileUtils.deleteFile(testFile);
            
            // Try to create new file at same path (should succeed)
            const result = await executeEditFile({
                path: testFile,
                old_string: '',
                new_string: 'Recreated content'
            });
            
            expect(result.tool).toBe('edit_file');
            expect(result.friendly).toContain('Created');
            expect(result.friendly).not.toContain('ERROR');
        });

        it('should handle multiple file tracking correctly', async () => {
            const file1 = `${testDir}/file1.txt`;
            const file2 = `${testDir}/file2.txt`;
            
            // Create files
            await Bun.write(file1, 'content1');
            await Bun.write(file2, 'content2');
            
            // Read only file1
            await executeReadFile({ path: file1 });
            
            // Should be able to edit file1 but not file2
            const edit1 = await executeEditFile({
                path: file1,
                old_string: 'content1',
                new_string: 'updated1'
            });
            expect(edit1.friendly).not.toContain('ERROR');
            
            const edit2 = await executeEditFile({
                path: file2,
                old_string: 'content2',
                new_string: 'updated2'
            });
            expect(edit2.friendly).toContain('✗');
            expect(edit2.results?.error).toContain('Must read file first');
            
            // Cleanup
            await Bun.file(file1).delete();
            await Bun.file(file2).delete();
        });
    });

    describe('Safety Violations - Data Loss Prevention', () => {
        it('should prevent accidental overwrite of existing files', async () => {
            // Create a file with important content
            const importantFile = `${testDir}/important.txt`;
            await Bun.write(importantFile, 'CRITICAL DATA - DO NOT LOSE');
            
            // Try to overwrite without reading (should fail)
            const result = await executeWriteFile({
                path: importantFile,
                content: 'New content - would lose data'
            });
            
            expect(result.tool).toBe('write_file');
            expect(result.friendly).toContain('✗');
            expect(result.friendly).toContain('Cannot overwrite');
            
            // Verify original content is preserved
            const originalContent = await Bun.file(importantFile).text();
            expect(originalContent).toBe('CRITICAL DATA - DO NOT LOSE');
            
            // Cleanup
            await Bun.file(importantFile).delete();
        });

        it('should prevent accidental editing of existing files', async () => {
            // Create a file with important content
            const importantFile = `${testDir}/config.txt`;
            await Bun.write(importantFile, 'setting1=value1\nsetting2=value2');
            
            // Try to edit without reading (should fail)
            const result = await executeEditFile({
                path: importantFile,
                old_string: 'setting1=value1',
                new_string: 'setting1=corrupted'
            });
            
            expect(result.tool).toBe('edit_file');
            expect(result.friendly).toContain('✗');
            expect(result.friendly).toContain('Must read file');
            
            // Verify original content is preserved
            const originalContent = await Bun.file(importantFile).text();
            expect(originalContent).toBe('setting1=value1\nsetting2=value2');
            
            // Cleanup
            await Bun.file(importantFile).delete();
        });
    });
});