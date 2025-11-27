import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FileUtils } from '../src/utils/file-utils.js';
import { TOOL_DEFINITION as WRITE_FILE_TOOL } from '../src/tools/internal/write-file.js';
import { TOOL_DEFINITION as EDIT_FILE_TOOL } from '../src/tools/internal/edit-file.js';

describe('No changes approval logic', () => {
    const testFile = 'tmp/test-no-changes.txt';
    const testContent = 'Hello, World!\nThis is a test file.\n';

    beforeEach(async () => {
        // Ensure test directory exists
        await Bun.write('tmp/.gitkeep', '');
        // Create test file
        await Bun.write(testFile, testContent);
    });

    afterEach(async () => {
        // Clean up test file
        await Bun.file(testFile)
            .delete()
            .catch(() => {
                // Ignore cleanup errors
            });
    });

    describe('write_file tool', () => {
        it('should not allow approval when content is identical', async () => {
            // Mark file as read first
            await FileUtils.readFile(testFile);

            const preview = await WRITE_FILE_TOOL.generatePreview?.({
                path: testFile,
                content: testContent, // Same content
            });

            expect(preview).not.toBeNull();
            expect(preview?.content).toContain('No changes - content is identical');
            expect(preview?.canApprove).toBe(false);
        });

        it('should allow approval when content is different', async () => {
            // Mark file as read first
            await FileUtils.readFile(testFile);

            const preview = await WRITE_FILE_TOOL.generatePreview?.({
                path: testFile,
                content: `${testContent}\nModified`,
            });

            expect(preview).not.toBeNull();
            expect(preview?.content).not.toContain('No changes - file content is identical');
            expect(preview?.canApprove).toBe(true);
        });

        it('should allow approval for new files', async () => {
            const newFile = 'tmp/test-new.txt';

            const preview = await WRITE_FILE_TOOL.generatePreview?.({
                path: newFile,
                content: 'New content',
            });

            expect(preview).not.toBeNull();
            expect(preview?.summary).toContain('Create new file');
            expect(preview?.canApprove).toBe(true);

            // Cleanup
            await Bun.file(newFile)
                .delete()
                .catch(() => {
                    // Ignore cleanup errors
                });
        });
    });

    describe('edit_file tool', () => {
        it('should not allow approval when edit results in no changes', async () => {
            // Mark file as read first
            await FileUtils.readFile(testFile);

            const preview = await EDIT_FILE_TOOL.generatePreview!({
                path: testFile,
                old_string: testContent,
                new_string: testContent, // Same content
            });

            expect(preview).not.toBeNull();
            expect(preview?.content).toContain('No changes - content is identical');
            expect(preview?.canApprove).toBe(false);
        });

        it('should allow approval when edit makes changes', async () => {
            // Mark file as read first
            await FileUtils.readFile(testFile);

            const preview = await EDIT_FILE_TOOL.generatePreview!({
                path: testFile,
                old_string: 'Hello',
                new_string: 'Hi',
            });

            expect(preview).not.toBeNull();
            expect(preview?.content).not.toContain('No changes - content is identical');
            expect(preview?.canApprove).toBe(true);
        });

        it('should allow approval for creating new file', async () => {
            const newFile = 'tmp/test-edit-new.txt';

            const preview = await EDIT_FILE_TOOL.generatePreview!({
                path: newFile,
                old_string: '', // Empty string means create new file
                new_string: 'New file content',
            });

            expect(preview).not.toBeNull();
            expect(preview?.summary).toContain('Create file');
            expect(preview?.canApprove).toBe(true);

            // Cleanup
            await Bun.file(newFile)
                .delete()
                .catch(() => {});
        });
    });
});
