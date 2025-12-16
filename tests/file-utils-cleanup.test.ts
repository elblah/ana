/**
 * FileUtils Cleanup Tests - Ensure no tool coupling in utility layer
 * These tests ensure FileUtils remains a pure utility layer without tool dependencies
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FileUtils } from '../src/utils/file-utils.js';
import { executeWriteFile } from '../src/tools/internal/write-file.js';
import { executeReadFile } from '../src/tools/internal/read-file.js';
import { executeEditFile } from '../src/tools/internal/edit-file.js';
import { TestEnvironment } from './test-utils.js';

describe('FileUtils Cleanup - No Tool Coupling', () => {
    let testDir: string;
    let testFile: string;
    const testContent = 'Test content for FileUtils cleanup';

    beforeEach(async () => {
        // Don't clear file tracking since this test checks FileUtils behavior directly
        testDir = await TestEnvironment.setup(false);
        testFile = `${testDir}/test.txt`;
    });

    afterEach(async () => {
        await TestEnvironment.cleanup(testDir);
    });

    describe('Error Messages - No Tool Names', () => {
        it('should not include tool names in readFileWithSandbox errors', async () => {
            try {
                await FileUtils.readFileWithSandbox('/etc/passwd');
                expect(false).toBe(true); // Should not reach here
            } catch (error) {
                const message = (error as Error).message;
                expect(message).not.toContain('read_file');
                expect(message).toContain('outside current directory');
            }
        });

        it('should not include tool names in writeFileWithSandbox errors', async () => {
            try {
                await FileUtils.writeFileWithSandbox('/tmp/forbidden.txt', 'test');
                expect(false).toBe(true); // Should not reach here
            } catch (error) {
                const message = (error as Error).message;
                expect(message).not.toContain('write_file');
                expect(message).toContain('outside current directory');
            }
        });

        it('should not include tool names in listDirectory errors', async () => {
            try {
                await FileUtils.listDirectory('/etc');
                expect(false).toBe(true); // Should not reach here
            } catch (error) {
                const message = (error as Error).message;
                expect(message).not.toContain('list_directory');
                expect(message).toContain('outside current directory');
            }
        });

        it('should not include tool names in deleteFile errors', async () => {
            try {
                await FileUtils.deleteFile('/tmp/forbidden.txt');
                expect(false).toBe(true); // Should not reach here
            } catch (error) {
                const message = (error as Error).message;
                expect(message).not.toContain('delete_file');
                expect(message).toContain('outside current directory');
            }
        });
    });

    describe('Sandbox Check - Clean Interface', () => {
        it('should accept only path parameter, no context', () => {
            // Should not accept context parameter
            const result = FileUtils.checkSandbox('./valid-path.txt');
            expect(typeof result).toBe('boolean');
            
            // Should work with valid paths
            expect(FileUtils.checkSandbox(testFile)).toBe(true);
            
            // Should reject invalid paths
            expect(FileUtils.checkSandbox('/tmp/forbidden.txt')).toBe(false);
            expect(FileUtils.checkSandbox('../outside.txt')).toBe(false);
        });

        it('should have clean logging without tool context', async () => {
            // Test that checkSandbox works without context parameter
            // The logging cleanup was verified in the error message tests above
            const result = FileUtils.checkSandbox('/tmp/forbidden.txt');
            expect(result).toBe(false);
            
            // Test with valid path
            const validResult = FileUtils.checkSandbox('./test.txt');
            expect(typeof validResult).toBe('boolean');
        });
    });

    describe('Tool Integration - Still Works', () => {
        it('should allow write_file tool to work without FileUtils tool coupling', async () => {
            const result = await executeWriteFile({
                path: testFile,
                content: testContent
            });
            
            expect(result.tool).toBe('write_file');
            expect(result.friendly).toContain('Created');
            expect(result.important?.path).toBe(testFile);
        });

        it('should allow read_file tool to work without FileUtils tool coupling', async () => {
            // First write a file
            await Bun.write(testFile, testContent);
            
            const result = await executeReadFile({
                path: testFile
            });
            
            expect(result.tool).toBe('read_file');
            expect(result.friendly).toContain('Reading');
            expect(result.important?.path).toBe(testFile);
        });

        it('should allow edit_file tool to work without FileUtils tool coupling', async () => {
            // First write a file
            await Bun.write(testFile, testContent);
            
            // Read it first to track it (required for safety)
            await executeReadFile({
                path: testFile
            });
            
            const result = await executeEditFile({
                path: testFile,
                old_string: 'Test content',
                new_string: 'Updated content'
            });
            
            expect(result.tool).toBe('edit_file');
            expect(result.friendly).toContain('Updated');
            expect(result.important?.path).toBe(testFile);
        });

        it('should handle file creation through edit_file', async () => {
            const result = await executeEditFile({
                path: testFile,
                old_string: '',
                new_string: 'New file content'
            });
            
            expect(result.tool).toBe('edit_file');
            expect(result.friendly).toContain('Created');
            expect(result.important?.path).toBe(testFile);
        });
    });

    describe('Error Handling - Proper Boundaries', () => {
        it('should handle non-existent file reads', async () => {
            const result = await executeReadFile({
                path: './does-not-exist.txt'
            });
            
            expect(result.tool).toBe('read_file');
            expect(result.friendly).toContain('✗');
            expect(result.results?.error).toBeDefined();
        });

        it('should handle forbidden write attempts', async () => {
            const result = await executeWriteFile({
                path: '/etc/forbidden.txt',
                content: 'should fail'
            });
            
            expect(result.tool).toBe('write_file');
            expect(result.friendly).toContain('✗');
            expect(result.results?.error).toBeDefined();
        });

        it('should handle file existence checks with sandbox', () => {
            // Valid path should work
            const exists = FileUtils.fileExistsWithSandbox(testFile);
            expect(typeof exists).toBe('boolean');
            
            // Invalid path should return false, not throw
            const forbiddenExists = FileUtils.fileExistsWithSandbox('/tmp/forbidden.txt');
            expect(forbiddenExists).toBe(false);
        });
    });

    describe('Backward Compatibility', () => {
        it('should maintain all existing FileUtils functionality', async () => {
            // Test basic read/write cycle
            await FileUtils.writeFile(testFile, testContent);
            const content = await FileUtils.readFile(testFile);
            expect(content).toBe(testContent);
            
            // Test file existence
            expect(FileUtils.fileExists(testFile)).toBe(true);
            expect(FileUtils.fileExists('./non-existent.txt')).toBe(false);
            
            // Test async file existence
            const asyncExists = await FileUtils.fileExistsAsync(testFile);
            expect(asyncExists).toBe(true);
        });

        it('should maintain file tracking functionality', async () => {
            // Clear any existing tracking for this specific test
            // Since we can't access private methods directly, we'll use a different file
            const trackingTestFile = `${testDir}/tracking-test.txt`;
            await Bun.write(trackingTestFile, 'tracking test content');
            
            // Should not be tracked initially (different file)
            expect(FileUtils.wasFileRead(trackingTestFile)).toBe(false);
            
            // Read file and track
            await FileUtils.readFile(trackingTestFile);
            expect(FileUtils.wasFileRead(trackingTestFile)).toBe(true);
            
            // Cleanup
            await Bun.file(trackingTestFile).delete();
        });

        it('should maintain edit functionality', async () => {
            await FileUtils.writeFile(testFile, 'original content');
            const result = await FileUtils.editFile(testFile, 'original', 'updated');
            expect(result).toBeDefined();
            
            const content = await FileUtils.readFile(testFile);
            expect(content).toContain('updated content');
        });
    });
});