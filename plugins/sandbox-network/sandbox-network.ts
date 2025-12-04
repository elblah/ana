/**
 * Network Sandbox Plugin for AI Coder (TypeScript/Bun version)
 *
 * Provides network sandboxing for shell commands using seccomp C program.
 * Default: disabled (network access allowed)
 */

import type { Plugin, PluginContext } from '../../src/core/plugin-system.js';
import type { PopupMenuItem } from '../../src/core/types/index.js';
import type { ToolCall } from '../../src/core/streaming-client.js';

// Seccomp C source code (embedded)
const SECCOMP_SOURCE = `
/*
 * Minimal Network Blocker using libseccomp
 */

#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <sys/prctl.h>
#include <seccomp.h>

static int install_network_filter(void) {
    scmp_filter_ctx ctx;
    int rc;

    ctx = seccomp_init(SCMP_ACT_ALLOW);
    if (!ctx) {
        perror("seccomp_init failed");
        return -1;
    }

    // Block network syscalls
    #define BLOCK_SYSCALL(name) do { \\
        rc = seccomp_rule_add(ctx, SCMP_ACT_ERRNO(EACCES), SCMP_SYS(name), 0); \\
        if (rc != 0 && rc != -EDOM) { \\
            fprintf(stderr, "Failed to block %s: %s\\n", #name, strerror(-rc)); \\
            seccomp_release(ctx); \\
            return -1; \\
        } \\
    } while(0)

    BLOCK_SYSCALL(socket);
    BLOCK_SYSCALL(connect);
    BLOCK_SYSCALL(bind);
    BLOCK_SYSCALL(listen);
    BLOCK_SYSCALL(accept);
    BLOCK_SYSCALL(accept4);
    BLOCK_SYSCALL(sendto);
    BLOCK_SYSCALL(recvfrom);
    BLOCK_SYSCALL(sendmsg);
    BLOCK_SYSCALL(recvmsg);
    BLOCK_SYSCALL(sendmmsg);
    BLOCK_SYSCALL(recvmmsg);
    BLOCK_SYSCALL(socketcall);

    #undef BLOCK_SYSCALL

    rc = seccomp_load(ctx);
    if (rc != 0) {
        fprintf(stderr, "Failed to load seccomp filter: %s\\n", strerror(-rc));
        seccomp_release(ctx);
        return -1;
    }

    seccomp_release(ctx);
    return 0;
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <command> [args...]\\n", argv[0]);
        return 1;
    }

    if (install_network_filter() != 0) {
        fprintf(stderr, "Failed to install network filter\\n");
        return 1;
    }

    execvp(argv[1], argv + 1);
    perror("execvp failed");
    return 1;
}
`;

// Plugin implementation - using the single API
export default function createSandboxNetworkPlugin(ctx: PluginContext): Plugin {
    let enabled = false;
    let compiledExecutable: string | null = null;
    let compilationInProgress = false;

    // Register popup menu item
    const updatePopupMenuItem = () => {
        const status = enabled ? 'ON' : 'OFF';
        ctx.registerPopupMenuItem({
            label: `Toggle Net Sandbox (${status})`,
            key: 'n',
            handler: () => {
                enabled = !enabled;
                const enabledStr = enabled ? 'true' : 'false';
                ctx.setConfig('sandbox_network.enabled', enabledStr);
                updatePopupMenuItem(); // Update the menu item label
                
                const statusText = enabled ? 'ENABLED' : 'DISABLED';
                console.log(`[*] Network sandbox ${statusText}`);
                
                // Verify config was set correctly
                const configValue = ctx.getConfig('sandbox_network.enabled');
                if (configValue !== enabledStr) {
                    console.log(`[!] Warning: Config mismatch. Expected ${enabledStr}, got ${configValue}`);
                }
            },
        });
    };

    // Initial registration
    updatePopupMenuItem();

    // Check requirements
    async function checkRequirements(): Promise<{ ok: boolean; missing: string[] }> {
        const missing: string[] = [];

        // Check for gcc
        try {
            const { spawn } = await import('node:child_process');
            await new Promise<void>((resolve, reject) => {
                const proc = spawn('gcc', ['--version'], { stdio: 'pipe' });
                proc.on('close', (code) => (code === 0 ? resolve() : reject()));
                proc.on('error', reject);
            });
        } catch {
            missing.push('gcc (install with: apt install build-essential)');
        }

        // Check for seccomp header
        try {
            const fs = await import('node:fs');
            const path = await import('node:path');
            const seccompPaths = [
                '/usr/include/seccomp.h',
                '/usr/local/include/seccomp.h',
                '/usr/include/x86_64-linux-gnu/seccomp.h',
            ];

            const headerExists = seccompPaths.some((p) => fs.existsSync(p));
            if (!headerExists) {
                missing.push('libseccomp-dev (install with: apt install libseccomp-dev)');
            }
        } catch {
            missing.push('libseccomp-dev (install with: apt install libseccomp-dev)');
        }

        return { ok: missing.length === 0, missing };
    }

    // Compile seccomp binary
    async function compileExecutable(): Promise<string | null> {
        if (compiledExecutable) {
            return compiledExecutable;
        }

        if (compilationInProgress) {
            return null;
        }

        compilationInProgress = true;

        try {
            const requirements = await checkRequirements();
            if (!requirements.ok) {
                console.log('[x] Network sandbox unavailable - missing requirements:');
                for (const req of requirements.missing) {
                    console.log(`    - ${req}`);
                }
                return null;
            }

            const fs = await import('node:fs');
            const path = await import('node:path');
            const { spawn } = await import('node:child_process');

            // Write source file
            const sourceFile = '/tmp/sandbox-network.c';
            await fs.promises.writeFile(sourceFile, SECCOMP_SOURCE);

            // Compile
            const executableFile = '/tmp/sandbox-network';
            const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
                const proc = spawn('gcc', ['-o', executableFile, sourceFile, '-lseccomp'], {
                    stdio: 'pipe',
                });

                let stderr = '';
                let stdout = '';
                proc.stderr?.on('data', (data) => {
                    stderr += data.toString();
                });
                proc.stdout?.on('data', (data) => {
                    stdout += data.toString();
                });

                proc.on('close', (code) => {
                    if (code === 0) {
                        resolve({ success: true });
                    } else {
                        resolve({ success: false, error: stderr });
                    }
                });

                proc.on('error', (error) => {
                    resolve({ success: false, error: error.message });
                });
            });

            if (!result.success) {
                console.log(`[x] Failed to compile network sandbox: ${result.error}`);
                return null;
            }

            // Make executable and clean up source
            await fs.promises.chmod(executableFile, 0o755);
            await fs.promises.unlink(sourceFile);

            // Verify the binary was created
            if (!fs.existsSync(executableFile)) {
                console.log('[x] Compilation succeeded but binary not found');
                return null;
            }

            compiledExecutable = executableFile;
            console.log('[+] Network sandbox compiled successfully');
            return executableFile;
        } catch (error) {
            console.log(`[x] Compilation failed: ${error}`);
            return null;
        } finally {
            compilationInProgress = false;
        }
    }

    // Get access to the app context to modify tool execution
    setTimeout(() => {
        if (ctx.app?.toolManager) {
            const toolManager = ctx.app.toolManager;
            const originalExecuteToolCall = toolManager.executeToolCall.bind(toolManager);

            // Override the executeToolCall method to intercept shell commands
            toolManager.executeToolCall = (async (toolCall: ToolCall) => {
                if (toolCall.function?.name === 'run_shell_command' && enabled) {
                    const args = JSON.parse(toolCall.function.arguments || '{}');
                    const originalCommand = args.command;
                    const executablePath = '/tmp/sandbox-network';

                    // Ensure binary is compiled
                    if (!compiledExecutable) {
                        console.log('[*] Compiling network sandbox...');
                        await compileExecutable();
                    }

                    const fs = require('node:fs');
                    if (fs.existsSync(executablePath)) {
                        const wrappedCommand = `${executablePath} sh -c "${originalCommand}"`;
                        console.log(`[*] Network sandbox active: ${originalCommand}`);

                        // Execute with sandbox wrapper
                        const modifiedToolCall = {
                            ...toolCall,
                            function: {
                                ...toolCall.function,
                                arguments: JSON.stringify({
                                    ...args,
                                    command: wrappedCommand,
                                }),
                            },
                        };

                        return await originalExecuteToolCall(modifiedToolCall);
                    }
                    console.log(
                        '[!] Network sandbox executable not found, running without protection'
                    );
                }

                // Fall back to normal execution
                return await originalExecuteToolCall(toolCall);
            }).bind(toolManager);

            // Hook installed silently
        }
    }, 100);

    // Command handler
    function handleSandboxCommand(commandArgs: string[]): boolean | undefined {
        if (!commandArgs.length) {
            const status = enabled ? 'enabled' : 'disabled';
            console.log(`Network sandbox: ${status}`);
            return;
        }

        const cmd = commandArgs[0].toLowerCase();

        switch (cmd) {
            case 'on':
                enabled = true;
                console.log('[+] Network sandbox enabled');
                console.log('    [INFO] Seccomp binary will be compiled on first shell command');
                ctx.setConfig('sandbox_network.enabled', 'true');
                updatePopupMenuItem();
                break;

            case 'off':
                enabled = false;
                console.log('[-] Network sandbox disabled');
                ctx.setConfig('sandbox_network.enabled', 'false');
                updatePopupMenuItem();
                break;

            case 'status': {
                const status = enabled ? 'enabled' : 'disabled';
                console.log(`Network sandbox: ${status}`);
                break;
            }

            case 'help':
                console.log(`Network sandbox command usage:
  /sandbox-net               - Show current status
  /sandbox-net on            - Enable network sandbox
  /sandbox-net off           - Disable network sandbox
  /sandbox-net status        - Show current status
  /sandbox-net help          - Show this help

When enabled, all shell commands will be executed in a network sandbox.
Network syscalls (socket, connect, bind, etc.) will be blocked.
This is useful when leaving the AI working unattended.

Default: sandbox disabled (network access allowed)

Requirements:
  - libseccomp-dev (install with: apt install libseccomp-dev)
  - gcc (install with: apt install build-essential)`);
                break;

            default:
                console.log(`Unknown option: ${cmd}. Use '/sandbox-network help' for commands.`);
        }
    }

    // Register commands
    ctx.registerCommand(
        '/sandbox-net',
        handleSandboxCommand,
        'Control network sandbox for shell commands'
    );
    ctx.registerCommand('/snet', handleSandboxCommand, 'Alias for sandbox-net');

    // Load saved state
    const savedEnabled = ctx.getConfig('sandbox_network.enabled');
    if (typeof savedEnabled === 'string') {
        enabled = savedEnabled === 'true';
    } else if (typeof savedEnabled === 'boolean') {
        enabled = savedEnabled;
    }
    
    // Update popup menu item with loaded state
    updatePopupMenuItem();

    // Check requirements on startup
    checkRequirements().then((reqs) => {
        if (!reqs.ok) {
            console.log('[!] Network sandbox - missing requirements:');
            for (const req of reqs.missing) {
                console.log(`        - ${req}`);
            }
        }
        // Only show success message if requirements missing was an issue
    });

    console.log('[+] Network sandbox plugin initialized');
    console.log('    Use /sandbox-network on|off to control');

    return {
        name: 'Network Sandbox Plugin',
        version: '1.0.0',
        description: 'Network sandboxing for shell commands using seccomp',
    };
}
