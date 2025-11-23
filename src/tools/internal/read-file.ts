/**
 * Read file internal tool implementation using centralized file utils
 */

import type { Stats } from '../../core/stats.js';
import { FileUtils } from '../../core/file-utils.js';
import { ToolFormatter, type ToolOutput } from '../../core/tool-formatter.js';
import type { ToolExecutionArgs } from '../../core/types.js';

export interface ReadFileParams {
    path: string;
    offset?: number;
    limit?: number;
}

export const TOOL_DEFINITION = {
    type: 'internal' as const,
    auto_approved: true,
    approval_excludes_arguments: false,
    approval_key_exclude_arguments: [],
    hide_results: false,
    description:
        'Reads the content from a specified file path. Supports pagination with offset and limit parameters.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The file system path to read from.',
            },
            offset: {
                type: 'number',
                description: 'The line number to start reading from (0-based, defaults to 0).',
                minimum: 0,
            },
            limit: {
                type: 'number',
                description: 'The number of lines to read (defaults to 2000).',
                minimum: 1,
            },
        },
        required: ['path'],
        additionalProperties: false,
    },
    formatArguments: (args: ToolExecutionArgs): string => {
        const { path, offset = 0, limit = DEFAULT_READ_LIMIT } = args as unknown as ReadFileParams;
        const lines: string[] = [];
        lines.push(`Path: ${path}`);

        if (offset !== 0) {
            lines.push(`Offset: ${offset}`);
        }

        if (limit !== DEFAULT_READ_LIMIT) {
            lines.push(`Limit: ${limit}`);
        }

        return lines.join('\n  ');
    },
};

const DEFAULT_READ_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;

/**
 * Execute read file operation
 */
export async function executeReadFile(params: ReadFileParams, stats: Stats): Promise<ToolOutput> {
    try {
        const { path, offset = 0, limit = DEFAULT_READ_LIMIT } = params;

        // Use FileUtils for sandboxed file reading
        let content: string;
        try {
            content = await FileUtils.readFile(path);
        } catch (error) {
            stats.incrementToolErrors();
            const errorOutput: ToolOutput = {
                tool: 'read_file',
                friendly: `ERROR: Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
                important: {
                    path: params.path,
                },
                results: {
                    error: error instanceof Error ? error.message : String(error),
                    showWhenDetailOff: true,
                },
            };
            return errorOutput;
        }

        // Split into lines
        const lines = content.split('\n');

        // Apply offset and limit
        const startLine = Math.max(0, offset);
        const endLine = Math.min(lines.length, startLine + limit);
        const selectedLines = lines.slice(startLine, endLine);

        // Truncate very long lines
        const truncatedLines = selectedLines.map((line) => {
            if (line.length > MAX_LINE_LENGTH) {
                return (
                    line.slice(0, MAX_LINE_LENGTH) + `... [truncated, total: ${line.length} chars]`
                );
            }
            return line;
        });

        // Build result
        let result = '';

        // Add context if we're not reading from the beginning
        if (offset > 0) {
            result = `[Reading from line ${offset}, total lines: ${lines.length}]\n\n`;
        }

        result += truncatedLines.join('\n');

        // Add note if truncated
        if (endLine < lines.length) {
            result += `\n\n[... ${lines.length - endLine} more lines not shown (use offset parameter to read more)]`;
        }

        // Create friendly message with range details
        let friendlyMessage: string;
        if (offset > 0 || limit < lines.length) {
            const startLine = offset + 1; // Convert to 1-based for user display
            const endLine = Math.min(offset + limit, lines.length);
            if (offset > 0 && endLine < lines.length) {
                friendlyMessage = `Reading lines ${startLine}-${endLine} of ${lines.length} from '${path}'`;
            } else if (offset > 0) {
                friendlyMessage = `Reading lines ${startLine}-${lines.length} from '${path}'`;
            } else {
                friendlyMessage = `Reading lines 1-${endLine} of ${lines.length} from '${path}'`;
            }
        } else {
            friendlyMessage = `Reading entire file '${path}' (${lines.length} lines)`;
        }

        // Create formatted output
        const output: ToolOutput = {
            tool: 'read_file',
            friendly: friendlyMessage,
            important: {
                path: path,
            },
            detailed: {
                offset: offset,
                limit: limit,
                total_lines: lines.length,
                content_size: `${Buffer.byteLength(content, 'utf8')} bytes`,
            },
            results: {
                content: result,
                showWhenDetailOff: false, // Don't show content by default
            },
        };

        stats.incrementToolCalls();
        stats.addToolTime(0.01); // Rough timing estimate

        // Return ToolOutput object
        return output;
    } catch (error) {
        stats.incrementToolErrors();
        const errorOutput: ToolOutput = {
            tool: 'read_file',
            friendly: `ERROR: Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
            important: {
                path: params.path,
            },
            results: {
                error: error instanceof Error ? error.message : String(error),
                showWhenDetailOff: true,
            },
        };
        return errorOutput;
    }
}
