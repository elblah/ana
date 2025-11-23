/**
 * List directory internal tool implementation using centralized file utils for sandbox
 */

import type { Stats } from '../../core/stats.js';
import { Config } from '../../core/config.js';
import { FileUtils } from '../../core/file-utils.js';
import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ToolFormatter, type ToolOutput } from '../../core/tool-formatter.js';
import type { ToolExecutionArgs } from '../../core/types.js';

export interface ListDirectoryParams {
    path?: string;
}

export const TOOL_DEFINITION = {
    type: 'internal' as const,
    auto_approved: true,
    approval_excludes_arguments: false,
    approval_key_exclude_arguments: [],
    hide_results: false,
    description:
        'Lists the contents of a specified directory recursively. Uses native Node.js functions. Defaults to current directory.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The path to the directory. Defaults to current directory.',
            },
        },
        additionalProperties: false,
    },
    formatArguments: (args: ToolExecutionArgs): string => {
        const { path } = args as ListDirectoryParams;
        const pathToUse = path || '.';
        return `Path: ${pathToUse}`;
    },
};

const MAX_FILES = 2000;

/**
 * Get friendly message for this tool based on parameters and results
 */
function getFriendlyMessage(output: ToolOutput): string {
    return output.friendly || 'Directory listing completed';
}

/**
 * Execute list directory operation
 */
export async function executeListDirectory(
    params: ListDirectoryParams,
    stats: Stats
): Promise<ToolOutput> {
    const startTime = Date.now();
    const { path = '.' } = params;

    try {
        // Resolve path
        const resolvedPath = path === '.' ? FileUtils.getCurrentDir() : resolve(path);

        // Check sandbox using FileUtils
        if (!FileUtils.checkSandbox(resolvedPath, 'list_directory')) {
            stats.incrementToolErrors();
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

        // Check if path exists and is a directory
        try {
            const statsResult = await stat(resolvedPath);
            if (!statsResult.isDirectory()) {
                stats.incrementToolErrors();
                const errorOutput: ToolOutput = {
                    tool: 'list_directory',
                    friendly: `Not a directory: '${resolvedPath}'`,
                    important: {
                        path: path,
                    },
                    results: {
                        error: `Path is not a directory: '${resolvedPath}'.`,
                        showWhenDetailOff: true,
                    },
                };
                return errorOutput;
            }
        } catch (error) {
            stats.incrementToolErrors();
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

        // Get files recursively
        const files = await getFilesRecursive(resolvedPath, MAX_FILES);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        stats.addToolTime(Number.parseFloat(duration));
        stats.incrementToolCalls();

        let output: ToolOutput;

        if (files.length === 0) {
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
        } else if (files.length >= MAX_FILES) {
            output = {
                tool: 'list_directory',
                friendly: `Found ${files.length}+ files (limited to ${MAX_FILES}) in '${resolvedPath}'`,
                important: {
                    path: path,
                },
                detailed: {
                    actual_count: files.length,
                    limit: MAX_FILES,
                    duration: `${duration}s`,
                },
                results: {
                    files: files.slice(0, MAX_FILES).join('\n'),
                    showWhenDetailOff: true,
                },
            };
        } else {
            output = {
                tool: 'list_directory',
                friendly: `✓ Found ${files.length} files in '${resolvedPath}'`,
                important: {
                    path: path,
                },
                detailed: {
                    file_count: files.length,
                    duration: `${duration}s`,
                },
                results: {
                    files: files.join('\n'),
                    showWhenDetailOff: true,
                },
            };
        }

        return output;
    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        stats.incrementToolErrors();
        stats.addToolTime(Number.parseFloat(duration));

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
 * Recursively get files in directory using Node.js functions
 */
async function getFilesRecursive(dirPath: string, maxFiles: number): Promise<string[]> {
    const files: string[] = [];

    async function traverse(currentPath: string, relativePath = ''): Promise<void> {
        if (files.length >= maxFiles) {
            return;
        }

        try {
            const entries = await readdir(currentPath);

            for (const entry of entries) {
                if (files.length >= maxFiles) {
                    break;
                }

                const entryPath = join(currentPath, entry);
                const relativeEntryPath = relativePath ? join(relativePath, entry) : entry;

                try {
                    const entryStat = await stat(entryPath);

                    if (entryStat.isFile()) {
                        files.push(relativeEntryPath);
                    } else if (entryStat.isDirectory()) {
                        // Skip hidden directories and common ignore directories
                        if (
                            !entry.startsWith('.') &&
                            !['node_modules', '.git', '.vscode', '.idea', 'dist', 'build'].includes(
                                entry
                            )
                        ) {
                            await traverse(entryPath, relativeEntryPath);
                        }
                    }
                } catch (statError) {
                    // Skip files we can't stat
                    if (Config.debug) {
                        console.error(`Skipping file ${entryPath}: ${statError}`);
                    }
                }
            }
        } catch (error) {
            // Skip directories we can't read
            if (Config.debug) {
                console.error(`Skipping directory ${currentPath}: ${error}`);
            }
        }
    }

    await traverse(dirPath);
    return files.sort();
}
