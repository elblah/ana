/**
 * Grep internal tool implementation using ripgrep when available
 */

import { Config } from '../../core/config.js';
import { FileUtils } from '../../utils/file-utils.js';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { ToolFormatter, type ToolOutput } from '../../core/tool-formatter.js';
import type { ToolExecutionArgs } from '../../core/types.js';

export interface GrepParams {
    text: string;
    path?: string;
    max_results?: number;
    context?: number;
}

export const TOOL_DEFINITION = {
    type: 'internal' as const,
    auto_approved: true,
    approval_excludes_arguments: false,
    approval_key_exclude_arguments: [] as string[],
    hide_results: false,
    description:
        'Search text in files using ripgrep with line numbers. Path defaults to current directory.',
    parameters: {
        type: 'object',
        properties: {
            text: {
                type: 'string',
                description: 'Text to search for.',
            },
            path: {
                type: 'string',
                description: 'Directory path to search in (defaults to current directory).',
            },
            max_results: {
                type: 'number',
                description: 'Maximum number of results (defaults to 2000).',
            },
            context: {
                type: 'number',
                description: 'Number of lines to show before/after match (defaults to 2).',
            },
        },
        required: ['text'],
        additionalProperties: false,
    },
    validateArguments: (args: ToolExecutionArgs): void => {
        const { text } = args as unknown as GrepParams;
        if (!text || typeof text !== 'string') {
            throw new Error('grep requires "text" argument (string)');
        }
        // Sandbox check is now handled by FileUtils
    },
    formatArguments: (args: ToolExecutionArgs): string => {
        const { text, path, max_results, context } = args as unknown as GrepParams;
        const parts: string[] = [];
        parts.push(`Text: "${text}"`);
        if (path && path !== '.') {
            parts.push(`Path: ${path}`);
        }
        if (max_results !== undefined && max_results !== 2000) {
            parts.push(`Max results: ${max_results}`);
        }
        if (context !== undefined && context !== 2) {
            parts.push(`Context: ${context} lines`);
        }
        return parts.join('\n  ');
    },
    execute: executeGrep,
};

const MAX_RESULTS = 2000;

/**
 * Execute grep operation
 */
export async function executeGrep(args: ToolExecutionArgs): Promise<ToolOutput> {
    const { text, path = '.', max_results = MAX_RESULTS, context = 2 } = args as unknown as GrepParams;

    try {
        // Validate search text
        if (!text.trim()) {
            const errorOutput: ToolOutput = {
                tool: 'grep',
                important: {
                    text: text,
                },
                results: {
                    error: 'Search text cannot be empty.',
                    showWhenDetailOff: true,
                },
            };
            return errorOutput;
        }

        // Resolve path using Node.js
        const searchPath = resolve(process.cwd(), path);

        // Check sandbox using FileUtils
        if (!FileUtils.checkSandbox(searchPath, 'grep')) {
            const errorOutput: ToolOutput = {
                tool: 'grep',
                friendly: `ERROR: Failed to search: path "${path}" outside current directory not allowed`,
                important: {
                    text: text,
                },
                results: {
                    error: `path "${path}" outside current directory not allowed`,
                    showWhenDetailOff: true,
                },
            };
            return errorOutput;
        }

        // Use ripgrep with node:child_process
        const proc = spawn(
            'rg',
            [
                '-n', // Line numbers
                '--max-count',
                max_results.toString(),
                '-C',
                context.toString(), // Context lines
                text,
                searchPath,
            ],
            {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: process.env,
            }
        );

        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        proc.stderr?.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        return new Promise((resolve, reject) => {
            proc.on('close', (code: number | null) => {
                if (code === 0 && stdout) {
                    // Count matches
                    const matchCount = stdout.split('\n').filter((line) => line.trim()).length;

                    const output: ToolOutput = {
                        tool: 'grep',
                        friendly:
                            matchCount === 0
                                ? `No matches found for "${text}" in "${path}"`
                                : matchCount === 1
                                  ? `Found 1 match for "${text}" in "${path}"`
                                  : `Found ${matchCount} matches for "${text}" in "${path}"`,
                        important: {
                            text: text,
                        },
                        detailed: {
                            path: path,
                            max_results: max_results,
                            context: context,
                        },
                        results: {
                            match_count: matchCount,
                            matches: stdout,
                            showWhenDetailOff: false, // Don't show actual matches by default
                        },
                    };

                    resolve(output);
                } else if (code === 1 && !stdout) {
                    const output: ToolOutput = {
                        tool: 'grep',
                        friendly: `No matches found for "${text}" in "${path}"`,
                        important: {
                            text: text,
                        },
                        detailed: {
                            path: path,
                        },
                        results: {
                            match_count: 0,
                            message: `No matches found for "${text}" in "${path}"`,
                            showWhenDetailOff: true, // Show "no matches" message even in simple mode
                        },
                    };

                    resolve(output);
                } else {
                    const errorOutput: ToolOutput = {
                        tool: 'grep',
                        friendly: `ERROR: Failed to search: ${stderr || `exit code ${code}`}`,
                        important: {
                            text: text,
                        },
                        detailed: {
                            path: path,
                        },
                        results: {
                            error: stderr || `exit code ${code}`,
                            showWhenDetailOff: true,
                        },
                    };

                    resolve(errorOutput);
                }
            });

            proc.on('error', (error: Error) => {
                const errorOutput: ToolOutput = {
                    tool: 'grep',
                    friendly: `ERROR: Failed to search: ${error.message}`,
                    important: {
                        text: text,
                    },
                    results: {
                        error: error.message,
                        showWhenDetailOff: true,
                    },
                };
                resolve(errorOutput);
            });
        });
    } catch (error) {
        const errorOutput: ToolOutput = {
            tool: 'grep',
            friendly: `ERROR: Failed to search: ${error instanceof Error ? error.message : String(error)}`,
            important: {
                text: text,
            },
            results: {
                error: error instanceof Error ? error.message : String(error),
                showWhenDetailOff: true,
            },
        };
        return errorOutput;
    }
}
