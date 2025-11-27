/**
 * Shell command utilities that work across Bun and Node.js environments
 */

export interface ShellResult {
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
}

export class ShellUtils {
    /**
     * Execute shell command and return result
     * Uses Bun API if available, otherwise falls back to Node.js child_process
     */
    static async executeCommand(command: string): Promise<ShellResult> {
        try {
            if (typeof Bun !== 'undefined') {
                return await this.executeBunCommand(command);
            } else {
                return await this.executeNodeCommand(command);
            }
        } catch (error) {
            return {
                success: false,
                exitCode: -1,
                stdout: '',
                stderr: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Execute command with timeout
     */
    static async executeCommandWithTimeout(
        command: string,
        timeoutSeconds: number
    ): Promise<ShellResult> {
        const timeoutCommand = `timeout -k 5 ${timeoutSeconds}s bash -c "${command.replace(/"/g, '\\"')}"`;
        return await this.executeCommand(timeoutCommand);
    }

    /**
     * Execute shell command synchronously
     * Uses Bun API if available, otherwise falls back to Node.js child_process
     */
    static executeCommandSync(command: string): ShellResult {
        try {
            if (typeof Bun !== 'undefined') {
                return this.executeBunCommandSync(command);
            } else {
                return this.executeNodeCommandSync(command);
            }
        } catch (error) {
            return {
                success: false,
                exitCode: -1,
                stdout: '',
                stderr: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Execute command using Bun.spawn
     */
    private static async executeBunCommand(command: string): Promise<ShellResult> {
        const proc = Bun.spawn(['bash', '-c', command], {
            stdout: 'pipe',
            stderr: 'pipe',
        });

        await proc.exited;

        // Read from ReadableStream before decoding
        let stdout = '';
        let stderr = '';

        if (proc.stdout) {
            const reader = proc.stdout.getReader();
            const result = await reader.read();
            if (result.value) {
                stdout = new TextDecoder().decode(result.value);
            }
        }

        if (proc.stderr) {
            const reader = proc.stderr.getReader();
            const result = await reader.read();
            if (result.value) {
                stderr = new TextDecoder().decode(result.value);
            }
        }

        return {
            success: proc.exitCode === 0,
            exitCode: proc.exitCode || 0,
            stdout,
            stderr,
        };
    }

    /**
     * Execute command using Bun.spawnSync
     */
    private static executeBunCommandSync(command: string): ShellResult {
        const result = Bun.spawnSync(['bash', '-c', command], {
            stdout: 'pipe',
            stderr: 'pipe',
        });

        // For spawnSync, stdout/stderr are already Uint8Array, so direct decoding works
        const stdout = result.stdout ? new TextDecoder().decode(result.stdout) : '';
        const stderr = result.stderr ? new TextDecoder().decode(result.stderr) : '';

        return {
            success: result.exitCode === 0,
            exitCode: result.exitCode || 0,
            stdout,
            stderr,
        };
    }

    /**
     * Execute command using Node.js child_process
     */
    private static async executeNodeCommand(command: string): Promise<ShellResult> {
        const { spawn } = await import('node:child_process');

        return new Promise((resolve) => {
            const proc = spawn('bash', ['-c', command], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';

            proc.stdout?.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            proc.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            proc.on('close', (code: number | null) => {
                resolve({
                    success: code === 0,
                    exitCode: code || 0,
                    stdout,
                    stderr,
                });
            });

            proc.on('error', (error: Error) => {
                resolve({
                    success: false,
                    exitCode: -1,
                    stdout: '',
                    stderr: error.message,
                });
            });
        });
    }

    /**
     * Execute command using Node.js child_process.sync
     */
    private static executeNodeCommandSync(command: string): ShellResult {
        const { spawnSync } = require('node:child_process');

        const result = spawnSync('bash', ['-c', command], {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        return {
            success: result.status === 0,
            exitCode: result.status || 0,
            stdout: result.stdout || '',
            stderr: result.stderr || '',
        };
    }
}
