import { FileUtils } from '../../utils/file-utils.js';
import { TempFileUtils } from '../../utils/temp-file-utils.js';
import { DiffUtils } from '../../utils/diff-utils.js';
import { ToolFormatter, type ToolOutput, type ToolPreview } from '../../core/tool-formatter.js';
import type { ToolExecutionArgs } from '../../core/types.js';

export interface EditFileParams {
    path: string;
    old_string: string;
    new_string: string;
}

/**
 * Edit file tool implementation - Simple, efficient, and reliable
 *
 * Philosophy:
 * - Less is more: Focus on the 95% use case (replacing specific text)
 * - Fail fast: Clear error messages without complex fuzzy matching
 * - Efficiency: Use Bun's native file operations
 * - Safety: Only edit files that have been read first
 */

export const TOOL_DEFINITION = {
    type: 'internal' as const,
    auto_approved: false,
    approval_excludes_arguments: true,
    approval_key_exclude_arguments: ['old_string', 'new_string'],
    hidden_parameters: ['old_string', 'new_string'],
    available_in_plan_mode: false,
    description: `Efficiently edit files by replacing exact text matches.

REQUIREMENTS:
- Must use read_file first to understand file content
- old_string must match file content EXACTLY (including whitespace)
- old_string must be unique within the file

COMMON OPERATIONS:
- Replace text: Provide both old_string and new_string
- Delete text: new_string = "" (empty string)
- Add text: old_string = "" with existing file path

UNIQUE MATCHING:
- If old_string appears multiple times, operation fails
- Add more context to make old_string unique
- Example: Include 2-3 lines before/after the target

PERFORMANCE NOTE:
- More efficient than write_file for single changes
- Avoids rewriting entire file when possible
- Preserves file permissions and metadata`,
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Absolute path to file to edit',
            },
            old_string: {
                type: 'string',
                description: 'Text to replace (must match file content exactly)',
            },
            new_string: {
                type: 'string',
                description: 'New text to replace old_string with',
            },
        },
        required: ['path', 'old_string', 'new_string'],
    },
    hide_results: false,
    validateArguments: async (args: ToolExecutionArgs): Promise<void> => {
        const { path, old_string, new_string } = args as unknown as EditFileParams;

        if (!path || typeof path !== 'string') {
            throw new Error('edit_file requires "path" argument (string)');
        }
        if (typeof old_string !== 'string') {
            throw new Error('edit_file requires "old_string" argument (string)');
        }
        if (typeof new_string !== 'string') {
            throw new Error('edit_file requires "new_string" argument (string)');
        }

        // Validate file exists and was read first
        const exists = await FileUtils.fileExistsWithSandboxAsync(path);
        if (exists && !FileUtils.wasFileRead(path)) {
            throw new Error(
                `edit_file: File "${path}" exists but wasn't read first. Read it first to avoid accidental overwrites.`
            );
        }

        // For existing files, validate old_string will match
        if (exists && old_string !== '') {
            const content = await FileUtils.readFileWithSandbox(path);
            if (!content.includes(old_string)) {
                throw new Error(
                    `edit_file: old_string not found in file "${path}". Use read_file to see exact content.`
                );
            }

            // Check for multiple matches
            const occurrences = (
                content.match(new RegExp(old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ||
                []
            ).length;
            if (occurrences > 1) {
                throw new Error(
                    `edit_file: old_string found ${occurrences} times in file. Make it unique by adding more context.`
                );
            }
        }
    },
    formatArguments: (args: ToolExecutionArgs): string => {
        const lines: string[] = [];
        const editArgs = args as unknown as EditFileParams;
        lines.push(`Path: ${editArgs.path}`);

        const oldString = editArgs.old_string;
        const newString = editArgs.new_string;

        if (oldString && oldString.length > 0) {
            const oldPreview =
                oldString.length > 50 ? oldString.substring(0, 50) + '... [hidden]' : oldString;
            lines.push(`Old: ${oldPreview}`);
        } else {
            lines.push('Old: [empty - inserting text]');
        }

        if (newString && newString.length > 0) {
            const newPreview =
                newString.length > 50 ? newString.substring(0, 50) + '... [hidden]' : newString;
            lines.push(`New: ${newPreview}`);
        } else {
            lines.push('New: [empty - deleting text]');
        }

        return lines.join('\n  ');
    },
    generatePreview: async (args: ToolExecutionArgs): Promise<ToolPreview | null> => {
        const { path, old_string, new_string } = args as unknown as EditFileParams;

        try {
            let diffContent = '';
            let warning = '';

            // Handle file creation (old_string is empty)
            if (old_string === '') {
                const exists = FileUtils.fileExistsWithSandbox(path);
                if (exists) {
                    return {
                        tool: 'edit_file',
                        summary: `Error: File already exists: ${path}`,
                        content: 'Cannot create file - it already exists',
                        warning: 'File creation failed',
                        canApprove: false,
                    };
                }

                // Create temporary files for diff (empty vs new content)
                const tempOld = TempFileUtils.createTempFile('original', '.txt');
                const tempNew = TempFileUtils.createTempFile('modified', '.txt');

                // Write content to temp files (empty file vs new content)
                await TempFileUtils.writeTempFile(tempOld, '');
                await TempFileUtils.writeTempFile(tempNew, new_string);

                // Generate diff using cross-platform utility
                diffContent = DiffUtils.generateUnifiedDiff(tempOld, tempNew);

                // Cleanup temp files
                TempFileUtils.deleteFile(tempOld);
                TempFileUtils.deleteFile(tempNew);
            } else {
                // File editing
                const exists = FileUtils.fileExistsWithSandbox(path);
                if (!exists) {
                    return {
                        tool: 'edit_file',
                        summary: `Error: File not found: ${path}`,
                        content: 'Cannot edit non-existent file',
                        warning: 'File not found',
                        canApprove: false,
                    };
                }

                // Check if file was read first
                if (!FileUtils.wasFileRead(path)) {
                    warning = 'File was not read first - recommend reading file before editing';
                }

                // Read current content
                const currentContent = await FileUtils.readFileWithSandbox(path);

                // Check if old_string exists and is unique
                if (!currentContent.includes(old_string)) {
                    return {
                        tool: 'edit_file',
                        summary: `Edit file: ${path}`,
                        content: `Error: old_string not found in file. Use read_file('${path}') to see current content and ensure exact match.`,
                        warning: 'Text to replace not found',
                        canApprove: false,
                    };
                }

                const occurrences = countOccurrences(currentContent, old_string);
                if (occurrences > 1) {
                    return {
                        tool: 'edit_file',
                        summary: `Edit file: ${path}`,
                        content: `Error: old_string appears ${occurrences} times in file. Provide more context to make it unique.`,
                        warning: 'Multiple matches found',
                        canApprove: false,
                    };
                }

                // Create temporary files for diff
                const tempOld = TempFileUtils.createTempFile('original', '.txt');
                const tempNew = TempFileUtils.createTempFile('modified', '.txt');

                // Write content to temp files
                await TempFileUtils.writeTempFile(tempOld, currentContent);

                // Apply the edit to get new content
                const newContent = currentContent.replace(old_string, new_string);
                await TempFileUtils.writeTempFile(tempNew, newContent);

                // Generate diff using cross-platform utility
                const diffResult = DiffUtils.generateUnifiedDiffWithStatus(tempOld, tempNew);
                diffContent = diffResult.diff;
                const hasChanges = diffResult.hasChanges;

                // Cleanup temp files
                TempFileUtils.deleteFile(tempOld);
                TempFileUtils.deleteFile(tempNew);

                return {
                    tool: 'edit_file',
                    summary: `Edit file: ${path}`,
                    content: diffContent,
                    warning: warning || undefined,
                    canApprove: hasChanges,
                    isDiff: true,
                };
            }

            // For new file creation (old_string is empty)
            return {
                tool: 'edit_file',
                summary: `Create file: ${path}`,
                content: diffContent,
                warning: warning || undefined,
                canApprove: true,
                isDiff: true,
            };
        } catch (error) {
            return {
                tool: 'edit_file',
                summary: `Edit file: ${path}`,
                content: `Error generating preview: ${error instanceof Error ? error.message : String(error)}`,
                warning: 'Preview generation failed',
                canApprove: false,
            };
        }
    },
    execute: executeEditFile,
};

/**
 * Execute edit_file operation
 */
export async function executeEditFile(
    args: ToolExecutionArgs
): Promise<ToolOutput> {
    const { path, old_string, new_string } = args as unknown as EditFileParams;
    try {

        // Safety check: File must have been read first (tracked by FileUtils)
        if (!FileUtils.wasFileRead(path)) {
            const errorOutput: ToolOutput = {
                tool: 'edit_file',
                friendly: `WARNING: Must read file '${path}' first before editing`,
                important: {
                    path: path,
                },
                results: {
                    error: `Must read file first. Use read_file('${path}') before editing.`,
                    showWhenDetailOff: true,
                },
            };
            return errorOutput;
        }

        // Handle file creation (old_string is empty)
        if (old_string === '') {
            return await createFile(path, new_string);
        }

        // Handle content replacement
        return await replaceContent(path, old_string, new_string);
    } catch (error) {
        const errorOutput: ToolOutput = {
            tool: 'edit_file',
            friendly: `ERROR: Failed to edit '${args.path}': ${error instanceof Error ? error.message : String(error)}`,
            important: {
                path: args.path,
            },
            results: {
                error: `Error editing file: ${error instanceof Error ? error.message : String(error)}`,
                showWhenDetailOff: true,
            },
        };
        return errorOutput;
    }
}

/**
 * Create a new file
 */
async function createFile(path: string, content: string): Promise<ToolOutput> {
    try {
        // Check if file already exists
        const exists = await FileUtils.fileExistsWithSandboxAsync(path);
        if (exists) {
            const errorOutput: ToolOutput = {
                tool: 'edit_file',
                friendly: `WARNING: File '${path}' already exists`,
                important: {
                    path: path,
                },
                results: {
                    error: `File already exists: ${path}`,
                    showWhenDetailOff: true,
                },
            };
            return errorOutput;
        }

        // Write the file (sandboxed)
        await FileUtils.writeFileWithSandbox(path, content);

        const output: ToolOutput = {
            tool: 'edit_file',
            friendly: `Created new file '${path}' with ${content.length} characters`,
            important: {
                path: path,
            },
            detailed: {
                operation: 'create',
                content_length: content.length,
            },
            results: {
                success: true,
                message: `Successfully created '${path}' (${content.length} characters)`,
                showWhenDetailOff: true,
            },
        };

        return output;
    } catch (error) {
        const errorOutput: ToolOutput = {
            tool: 'edit_file',
            important: {
                path: path,
            },
            results: {
                error: `Error creating file: ${error instanceof Error ? error.message : String(error)}`,
                showWhenDetailOff: true,
            },
        };
        return errorOutput;
    }
}

/**
 * Replace content in existing file
 */
async function replaceContent(
    path: string,
    oldString: string,
    newString: string
): Promise<ToolOutput> {
    try {
        // Read current content (sandboxed)
        const content = await FileUtils.readFileWithSandbox(path);

        // Check if old_string exists
        if (!content.includes(oldString)) {
            // Try to provide helpful context
            const suggestion = generateNotFoundSuggestion(content, oldString, path);
            const errorOutput: ToolOutput = {
                tool: 'edit_file',
                friendly: `ERROR: Text not found in '${path}' - check exact match including whitespace`,
                important: {
                    path: path,
                },
                detailed: {
                    old_string_length: oldString.length,
                },
                results: {
                    error: `old_string not found in file. ${suggestion}`,
                    showWhenDetailOff: true,
                },
            };
            return errorOutput;
        }

        // Check for multiple matches
        const occurrences = countOccurrences(content, oldString);
        if (occurrences > 1) {
            const positions = getOccurrencePositions(content, oldString);
            const errorOutput: ToolOutput = {
                tool: 'edit_file',
                important: {
                    path: path,
                },
                detailed: {
                    old_string_length: oldString.length,
                    occurrences: occurrences,
                    positions: positions,
                },
                results: {
                    error: `old_string appears ${occurrences} times in file. Please provide more context to make it unique.`,
                    showWhenDetailOff: true,
                },
            };
            return errorOutput;
        }

        // Check if content is actually changing
        if (oldString === newString) {
            const errorOutput: ToolOutput = {
                tool: 'edit_file',
                important: {
                    path: path,
                },
                results: {
                    error: 'new_string is the same as old_string. No changes needed.',
                    showWhenDetailOff: true,
                },
            };
            return errorOutput;
        }

        // Perform replacement
        const newContent = content.replace(oldString, newString);

        // Write back to file (sandboxed)
        await FileUtils.writeFileWithSandbox(path, newContent);

        const output: ToolOutput = {
            tool: 'edit_file',
            friendly:
                oldString === ''
                    ? `✓ Created '${path}' (${newString.length} chars)`
                    : newString === ''
                      ? `✓ Deleted content from '${path}' (${oldString.length} chars removed)`
                      : `✓ Updated '${path}' (${oldString.length} → ${newString.length} chars)`,
            important: {
                path: path,
            },
            detailed: {
                operation: 'replace',
                old_string_length: oldString.length,
                new_string_length: newString.length,
                total_content_length: newContent.length,
            },
            results: {
                success: true,
                message: `Successfully updated '${path}' (${newContent.length} characters total)`,
                showWhenDetailOff: true,
            },
        };

        return output;
    } catch (error) {
        const errorOutput: ToolOutput = {
            tool: 'edit_file',
            important: {
                path: path,
            },
            results: {
                error: `Error replacing content in file: ${error instanceof Error ? error.message : String(error)}`,
                showWhenDetailOff: true,
            },
        };
        return errorOutput;
    }
}

/**
 * Count occurrences of a substring
 */
function countOccurrences(content: string, substring: string): number {
    let count = 0;
    let pos = 0;

    while ((pos = content.indexOf(substring, pos)) !== -1) {
        count++;
        pos += substring.length;
    }

    return count;
}

/**
 * Get line positions where substring occurs
 */
function getOccurrencePositions(content: string, substring: string): number[] {
    const positions: number[] = [];
    let pos = 0;

    while ((pos = content.indexOf(substring, pos)) !== -1) {
        const lineNum = content.substring(0, pos).split('\n').length;
        positions.push(lineNum);
        pos += substring.length;
    }

    return positions;
}

/**
 * Generate helpful suggestion when old_string not found
 */
function generateNotFoundSuggestion(content: string, oldString: string, path: string): string {
    // Check for common issues
    const lines = content.split('\n');

    // Look for partial matches (case insensitive)
    const oldLower = oldString.toLowerCase();
    const suggestions: string[] = [];

    for (let i = 0; i < Math.min(lines.length, 50); i++) {
        const line = lines[i];
        if (line.toLowerCase().includes(oldLower.substring(0, 10))) {
            suggestions.push(`Line ${i + 1}: ${line.trim().substring(0, 60)}...`);
            if (suggestions.length >= 3) break;
        }
    }

    if (suggestions.length > 0) {
        return `Did you mean one of these?
${suggestions.join('\n')}

Tip: Use read_file('${path}') to see the exact current content.`;
    }

    return `Use read_file('${path}') to see current content and ensure old_string matches exactly.`;
}
