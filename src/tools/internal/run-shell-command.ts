/**
 * Run shell command internal tool implementation using native Bun functions
 */

import { Stats } from '../../core/stats.js';
import { Config } from '../../core/config.js';
import { ToolFormatter, ToolOutput } from '../../core/tool-formatter.js';

export interface RunShellCommandParams {
  command: string;
  timeout?: number;
  reason?: string;
}

export const TOOL_DEFINITION = {
  type: 'internal',
  auto_approved: false,
  approval_excludes_arguments: false,
  approval_key_exclude_arguments: [],
  hide_results: false,
  description: 'Executes a shell command and returns its output.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute.',
      },
      timeout: {
        type: 'integer',
        description: 'Timeout in seconds (default: 30). Set to a higher value for long-running commands.',
        default: 30,
        minimum: 1,
      },
      reason: {
        type: 'string',
        description: 'Optional reason for running the command.',
      },
    },
    required: ['command'],
    additionalProperties: false,
  },
  formatArguments: (args: RunShellCommandParams): string => {
    const lines: string[] = [];
    lines.push(`Command: ${args.command}`);
    if (args.reason) {
      lines.push(`Reason: ${args.reason}`);
    }
    if (args.timeout !== undefined && args.timeout !== 30) {
      lines.push(`Timeout: ${args.timeout}s`);
    }
    return lines.join('\n');
  },
};

/**
 * Execute shell command operation
 */
export async function executeRunShellCommand(
  params: RunShellCommandParams,
  stats: Stats
): Promise<ToolOutput> {
  const startTime = Date.now();
  const { command, timeout = 30, reason } = params;

  try {
    let stdout: string;
    let stderr: string;
    let exitCode: number;
    let timedOut = false;

    if (typeof Bun !== 'undefined') {
      // Use Bun.spawn
      const proc = Bun.spawn(['sh', '-c', command], {
        stdout: 'pipe',
        stderr: 'pipe',
        env: process.env,
      });

      // Set up timeout with race condition
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          proc.kill();
          timedOut = true;
          reject(new Error(`Command timed out after ${timeout} seconds`));
        }, timeout * 1000);
        
        // Clear timeout if command completes normally
        Promise.race([
          proc.exited,
          new Promise(resolve => setTimeout(resolve, timeout * 1000))
        ]).then(() => clearTimeout(timeoutId));
      });

      try {
        [stdout, stderr] = await Promise.race([
          Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
          ]),
          timeoutPromise
        ]);
        exitCode = await proc.exited;
      } catch (error: any) {
        if (timedOut) {
          throw error;
        }
        proc.kill();
        throw error;
      }
    } else {
      // Use Node.js child_process with proper timeout
      const { spawn } = await import('node:child_process');
      const proc = spawn('sh', ['-c', command], {
        env: process.env,
        detached: true, // Allow proper process group management
      });

      // Set up timeout with race condition
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          process.kill(-proc.pid!, 'SIGTERM'); // Kill negative PID = process group
          timedOut = true;
          reject(new Error(`Command timed out after ${timeout} seconds`));
        }, timeout * 1000);
        
        // Clear timeout if command completes normally
        const clearTimer = () => clearTimeout(timeoutId);
        proc.on('close', clearTimer);
        proc.on('error', clearTimer);
      });

      try {
        [stdout, stderr] = await Promise.race([
          Promise.all([
            new Promise<string>((resolve, reject) => {
              let data = '';
              proc.stdout?.on('data', (chunk) => data += chunk);
              proc.stdout?.on('end', () => resolve(data));
              proc.stdout?.on('error', reject);
            }),
            new Promise<string>((resolve, reject) => {
              let data = '';
              proc.stderr?.on('data', (chunk) => data += chunk);
              proc.stderr?.on('end', () => resolve(data));
              proc.stderr?.on('error', reject);
            }),
          ]),
          timeoutPromise
        ]);
        
        exitCode = await new Promise<number>((resolve, reject) => {
          proc.on('close', (code) => resolve(code || 0));
          proc.on('error', reject);
        });
      } catch (error: any) {
        if (timedOut) {
          throw error;
        }
        process.kill(-proc.pid!, 'SIGTERM');
        throw error;
      }
    }

    const duration = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));

    // Build result
    let result = `$ ${command}`;

    if (reason && Config.debug) {
      result += ` # ${reason}`;
    }

    result += `\nExit code: ${exitCode}`;
    result += `\nDuration: ${duration}s`;

    if (stdout) {
      result += `\n\n--- STDOUT ---\n${stdout}`;
    }

    if (stderr) {
      result += `\n\n--- STDERR ---\n${stderr}`;
    }

    // Create a more informative friendly message
    let friendlyMessage: string;
    if (exitCode === 0) {
      friendlyMessage = `✓ Command completed in ${duration}s (exit code: ${exitCode})`;
    } else {
      friendlyMessage = `✗ Command failed in ${duration}s (exit code: ${exitCode})`;
    }

    // Create formatted output
    const output: ToolOutput = {
      tool: 'run_shell_command',
      friendly: friendlyMessage,
      important: {
        command: command
      },
      detailed: {
        reason: reason,
        timeout: `${timeout}s`,
        exit_code: exitCode,
        duration: `${duration}s`
      },
      results: {
        stdout: stdout,
        stderr: stderr,
        showWhenDetailOff: false // Don't show command output by default
      }
    };

    stats.addToolTime(duration);
    stats.incrementToolCalls();

    // Return formatted output
    return output;

  } catch (error) {
    const duration = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
    stats.incrementToolErrors();
    stats.addToolTime(duration);

    const errorMsg = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMsg.includes('timed out');

    const errorOutput: ToolOutput = {
      tool: 'run_shell_command',
      friendly: isTimeout
        ? `TIMEOUT: Command timed out after ${timeout} seconds`
        : `ERROR: Command failed: ${errorMsg}`,
      important: {
        command: command
      },
      detailed: {
        timeout: `${timeout}s`,
        duration: `${duration}s`
      },
      results: {
        error: isTimeout
          ? `Command timed out after ${timeout} seconds`
          : `Error executing command: ${errorMsg}`,
        showWhenDetailOff: true
      }
    };
    return errorOutput;
  }
}