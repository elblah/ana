/**
 * List directory internal tool implementation using find command
 */

import { Config } from '../../core/config.js';
import { FileUtils } from '../../utils/file-utils.js';
import { resolve } from 'node:path';
import { ToolFormatter, type ToolOutput } from '../../core/tool-formatter.js';
import { ShellUtils } from '../../utils/shell-utils.js';
import type { ToolExecutionArgs } from '../../core/types/tool-types.js';

// Maximum number of files to return to prevent overwhelming output
const MAX_FILES = 100;

/**
 * Execute list directory operation using find command
 */
export async function executeListDirectory(
    args: ToolExecutionArgs
): Promise<ToolOutput> {
    const params = args as unknown as ListDirectoryParams;
    const { path = '.' } = params;

    try {
        // Resolve path
        const resolvedPath = path === '.' ? FileUtils.getCurrentDir() : resolve(path);

        // Check sandbox using FileUtils
        if (!FileUtils.checkSandbox(resolvedPath, 'list_directory')) {
            const errorOutput: ToolOutput = {
                tool: 'list_directory',
                friendly: `Access denied: Path '${path}' is outside current directory`,
                important: {
                    path: path,
                },
                results: {
                    error: `Path '${path}' resolves outside current directory '${FileUtils.getCurrentDir()}'. Access denied.`,
                    showWhenDetailOff: true,
                },
            };
            return errorOutput;
        }

        // Check if path exists and is a directory using ls
        const checkResult = await ShellUtils.executeCommand(`ls -d "${resolvedPath}"`);
        if (checkResult.exitCode !== 0) {
            const errorOutput: ToolOutput = {
                tool: 'list_directory',
                friendly: `Directory not found: '${resolvedPath}'`,
                important: {
                    path: path,
                },
                results: {
                    error: `Directory not found at '${resolvedPath}'.`,
                    showWhenDetailOff: true,
                },
            };
            return errorOutput;
        }

        // Use find to list files - much faster and simpler
        const findCommand = `find "${resolvedPath}" -type f -print0 | head -z -n ${MAX_FILES + 1} | tr '\\0' '\\n'`;
        const result = await ShellUtils.executeCommand(findCommand);

        if (result.exitCode !== 0) {
            throw new Error(`find command failed: ${result.stderr}`);
        }

        // Split and filter files
        let files = result.stdout
            .split('\n')
            .filter(file => file.length > 0) // Remove empty lines
            .map(file => file.trim())
            .filter(file => file.length > 0); // Remove any remaining empty lines

        // Remove the target if it appears in results (some find versions do this)
        files = files.filter(file => file !== resolvedPath);

        const actualCount = files.length;
        const limitedFiles = files.slice(0, MAX_FILES);

        let output: ToolOutput;

        if (limitedFiles.length === 0) {
            output = {
                tool: 'list_directory',
                friendly: `Directory is empty: '${resolvedPath}'`,
                important: {
                    path: path,
                },
                results: {
                    message: `Directory is empty: '${resolvedPath}'`,
                    showWhenDetailOff: true,
                },
            };
        } else if (actualCount > MAX_FILES) {
            output = {
                tool: 'list_directory',
                friendly: `Found ${actualCount}+ files (limited to ${MAX_FILES}) in '${resolvedPath}'`,
                important: {
                    path: path,
                },
                detailed: {
                    actual_count: actualCount,
                    limit: MAX_FILES,
                },
                results: {
                    files: limitedFiles.join('\n'),
                    showWhenDetailOff: true,
                },
            };
        } else {
            output = {
                tool: 'list_directory',
                friendly: `✓ Found ${actualCount} files in '${resolvedPath}'`,
                important: {
                    path: path,
                },
                detailed: {
                    file_count: actualCount,
                },
                results: {
                    files: limitedFiles.join('\n'),
                    showWhenDetailOff: true,
                },
            };
        }

        return output;
    } catch (error) {
        const errorOutput: ToolOutput = {
            tool: 'list_directory',
            friendly: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`,
            important: {
                path: path,
            },
            results: {
                error: error instanceof Error ? error.message : String(error),
                showWhenDetailOff: true,
            },
        };

        return errorOutput;
    }
}

/**
 * Tool definition for list directory
 */
export const TOOL_DEFINITION = {
    type: 'internal' as const,
    auto_approved: true,
    approval_excludes_arguments: false,
    approval_key_exclude_arguments: [],
    hide_results: false,
    description: 'List files and directories recursively with configurable maximum',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Directory path to list (defaults to current directory)',
            },
        },
        additionalProperties: false,
    },
    validateArguments: (args: ListDirectoryParams): void => {
        if (!args.path || args.path.trim() === '') {
            args.path = '.';
        }
    },
    formatArguments: (args: ToolExecutionArgs): string | undefined => {
        const { path } = args as unknown as ListDirectoryParams;
        if (path && path !== '.') {
            return `Listing directory: ${path}`;
        }
        return 'Listing current directory';
    },
    execute: executeListDirectory,
};

// Type for list directory parameters
export interface ListDirectoryParams {
    path?: string;
}