/**
 * Write file internal tool implementation using centralized file utils
 */

import { FileUtils } from '../../utils/file-utils.js';
import { ToolFormatter, type ToolOutput, type ToolPreview } from '../../core/tool-formatter.js';
import { TempFileUtils } from '../../utils/temp-file-utils.js';
import { DiffUtils } from '../../utils/diff-utils.js';
import type { ToolExecutionArgs } from '../../core/types.js';

export interface WriteFileParams {
    path: string;
    content: string;
}

export const TOOL_DEFINITION = {
    type: 'internal' as const,
    auto_approved: false,
    approval_excludes_arguments: false,
    approval_key_exclude_arguments: [] as string[],
    hide_results: false,
    description: 'Writes complete content to a file, creating directories as needed.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The file system path where to write the content.',
            },
            content: {
                type: 'string',
                description: 'The content to write to the file.',
            },
        },
        required: ['path', 'content'],
        additionalProperties: false,
    },
    validateArguments: (args: ToolExecutionArgs): void => {
        const { path, content } = args as unknown as WriteFileParams;
        if (!path || typeof path !== 'string') {
            throw new Error('write_file requires "path" argument (string)');
        }
        if (content === undefined) {
            throw new Error('write_file requires "content" argument');
        }
        // Sandbox check is handled by FileUtils in executeWriteFile

        // Safety: Check if file exists and wasn't read first
        if (FileUtils.fileExistsWithSandbox(path) && !FileUtils.wasFileRead(path)) {
            throw new Error(
                `write_file: File "${path}" exists but wasn't read first. Read it first to avoid accidental overwrites.`
            );
        }
    },
    formatArguments: (args: ToolExecutionArgs): string => {
        const { path, content } = args as unknown as WriteFileParams;
        const lines: string[] = [];
        lines.push(`Path: ${path}`);
        const contentPreview =
            content.length > 100
                ? content.substring(0, 100) + `... (${content.length} chars total)`
                : content;
        lines.push(`Content: ${contentPreview}`);
        return lines.join('\n  ');
    },
    generatePreview: async (args: ToolExecutionArgs): Promise<ToolPreview | null> => {
        const { path, content } = args as unknown as WriteFileParams;

        try {
            // Check if file exists
            const exists = FileUtils.fileExistsWithSandbox(path);
            let diffContent = '';

            // Create temporary files for diff
            const tempOld = TempFileUtils.createTempFile('old', '.txt');
            const tempNew = TempFileUtils.createTempFile('new', '.txt');

            // Write content to temp files
            if (exists) {
                const existingContent = await FileUtils.readFileWithSandbox(path);
                await TempFileUtils.writeTempFile(tempOld, existingContent);
            } else {
                // For new files, write empty content to old file
                await TempFileUtils.writeTempFile(tempOld, '');
            }
            await TempFileUtils.writeTempFile(tempNew, content);

            // Generate diff using cross-platform utility
            const diffResult = DiffUtils.generateUnifiedDiffWithStatus(tempOld, tempNew);
            diffContent = diffResult.diff;

            // Cleanup temp files
            TempFileUtils.deleteFile(tempOld);
            TempFileUtils.deleteFile(tempNew);

            return {
                tool: 'write_file',
                summary: exists ? `Modify existing file: ${path}` : `Create new file: ${path}`,
                content: diffContent,
                warning:
                    exists && !FileUtils.wasFileRead(path)
                        ? 'File exists but was not read first - potential overwrite'
                        : undefined,
                canApprove: diffResult.hasChanges, // Only approve if there are actual differences
                isDiff: true,
            };
        } catch (error) {
            return {
                tool: 'write_file',
                summary: `Write to file: ${path}`,
                content: `Error generating preview: ${error instanceof Error ? error.message : String(error)}`,
                warning: 'Preview generation failed',
                canApprove: false,
            };
        }
    },
    execute: executeWriteFile,
};

/**
 * Execute write file operation
 */
export async function executeWriteFile(args: ToolExecutionArgs): Promise<ToolOutput> {
    const params = args as unknown as WriteFileParams;
    try {
        const { path, content } = params;

        // Use FileUtils for sandboxed file writing
        let result: string;
        try {
            result = await FileUtils.writeFileWithSandbox(path, content);
        } catch (error) {
            // Create error output
            const errorOutput: ToolOutput = {
                tool: 'write_file',
                friendly: `ERROR: Failed to write '${path}': ${error instanceof Error ? error.message : String(error)}`,
                important: {
                    path: path,
                },
                detailed: {
                    content_length: content.length,
                },
                results: {
                    error: error instanceof Error ? error.message : String(error),
                    showWhenDetailOff: true, // Show errors even in simple mode
                },
            };
            return errorOutput;
        }

        // Get file size
        const bytes = Buffer.byteLength(content, 'utf8');
        const lines = content.split('\n').length;

        // Create formatted output with better messaging
        const output: ToolOutput = {
            tool: 'write_file',
            friendly: `✓ Created '${path}' (${lines} lines, ${bytes} bytes)`,
            important: {
                path: path,
            },
            detailed: {
                content_length: content.length,
                bytes: bytes,
                lines: lines,
            },
            results: {
                success: true,
                message: result,
                showWhenDetailOff: true, // Show write success even in simple mode
            },
        };

        // Return ToolOutput object
        return output;
    } catch (error) {
        const errorOutput: ToolOutput = {
            tool: 'write_file',
            friendly: `ERROR: Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
            important: {
                path: params.path,
            },
            results: {
                error: `Error writing file: ${error instanceof Error ? error.message : String(error)}`,
                showWhenDetailOff: true, // Show errors even in simple mode
            },
        };
        return errorOutput;
    }
}
