/**
 * Run shell command internal tool implementation using cross-platform ShellUtils
 */

import { Config } from '../../core/config.js';
import { ToolFormatter, type ToolOutput } from '../../core/tool-formatter.js';
import { ShellUtils, type ShellResult } from '../../utils/shell-utils.js';
import type { ToolExecutionArgs } from '../../core/types/tool-types.js';

export interface RunShellCommandParams {
    command: string;
    timeout?: number;
    reason?: string;
}

export const TOOL_DEFINITION = {
    type: 'internal' as const,
    auto_approved: false,
    approval_excludes_arguments: false,
    approval_key_exclude_arguments: [] as string[],
    hide_results: false,
    description: 'Executes a shell (BASH) command and returns its output.',
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The shell command to execute.',
            },
            timeout: {
                type: 'number',
                description: 'Timeout in seconds (default: 30)',
                default: 30,
            },
            reason: {
                type: 'string',
                description: 'Reason for running this command (for logging)',
            },
        },
        required: ['command'],
    },
    validateArguments: (args: ToolExecutionArgs): void => {
        const { command } = args as unknown as RunShellCommandParams;
        if (!command || typeof command !== 'string') {
            throw new Error('run_shell_command requires "command" argument (string)');
        }
    },
    formatArguments: (args: ToolExecutionArgs): string => {
        const { command, timeout = 30, reason } = args as unknown as RunShellCommandParams;
        const lines: string[] = [];
        lines.push(`Command: ${command}`);

        if (reason) {
            lines.push(`Reason: ${reason}`);
        }

        if (timeout !== 30) {
            lines.push(`Timeout: ${timeout}s`);
        }

        return lines.join('\n');
    },
    execute: executeRunShellCommand,
} as const;

export async function executeRunShellCommand(
    args: ToolExecutionArgs
): Promise<ToolOutput> {
    const params = args as unknown as RunShellCommandParams;
    const { command, timeout = 30, reason = 'Command execution' } = params;

    try {
        let result: ShellResult;

        if (timeout > 0) {
            result = await ShellUtils.executeCommandWithTimeout(command, timeout);
        } else {
            result = await ShellUtils.executeCommand(command);
        }

        // Create friendly message with better debugging
        let friendlyMessage: string;
        if (result.success) {
            friendlyMessage = `✓ Command completed (exit code: ${result.exitCode})`;
        } else if (result.exitCode === 124) {
            friendlyMessage = `Command timed out after ${timeout}s (exit code: 124)`;
        } else {
            friendlyMessage = `✗ Command failed (exit code: ${result.exitCode})`;
            // Add stderr to friendly message for better debugging
            if (result.stderr.trim()) {
                friendlyMessage += ` - ${result.stderr.trim()}`;
            }
        }

        return {
            tool: 'run_shell_command',
            friendly: friendlyMessage,
            important: {
                command,
                success: result.success,
                timedOut: result.exitCode === 124,
                debugInfo: {
                    hasStdout: result.stdout.trim().length > 0,
                    hasStderr: result.stderr.trim().length > 0,
                    exitCode: result.exitCode,
                    success: result.success
                }
            },
            detailed: {
                reason,
                timeout: `${timeout}s`,
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
            },
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        return {
            tool: 'run_shell_command',
            friendly: `✗ Command failed: ${errorMessage}`,
            important: {
                command,
                error: errorMessage,
            },
            detailed: {
                reason,
                timeout: `${timeout}s`,
                error: errorMessage,
            },
        };
    }
}
