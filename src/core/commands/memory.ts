/**
 * Memory command - Edit conversation memory in $EDITOR, plus memory injection features
 */

import { BaseCommand, type CommandResult } from './base.js';
import { Config } from '../config.js';
import { LogUtils } from '../../utils/log-utils.js';
import { FileUtils } from '../../utils/file-utils.js';
import { MemoryManager } from '../memory-manager.js';
import { unlinkSync } from 'node:fs';
import { exec } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { TempFileUtils } from '../../utils/temp-file-utils.js';
import { JsonUtils } from '../../utils/json-utils.js';

export class MemoryCommand extends BaseCommand {
    protected name = 'memory';
    protected description = 'Edit conversation memory in $EDITOR (original behavior)';

    getAliases(): string[] {
        return ['m'];
    }

    async execute(args: string[]): Promise<CommandResult> {
        // If no arguments, do original behavior (edit conversation)
        if (args.length === 0) {
            return await this.handleOriginalEdit();
        }

        // Handle subcommands
        const subcommand = args[0];
        const memoryManager = MemoryManager.getInstance();

        switch (subcommand) {
            case 'inject':
                return await this.handleInject(args.slice(1), memoryManager);
            case 'remind':
                return await this.handleRemind(args.slice(1), memoryManager);
            case 'list':
                return await this.handleList(memoryManager);
            default:
                LogUtils.error(`Unknown subcommand: ${subcommand}`);
                this.showUsage();
                return { shouldQuit: false, runApiCall: false };
        }
    }

    /**
     * Original memory editing behavior
     */
    private async handleOriginalEdit(): Promise<CommandResult> {
        if (!process.env.TMUX) {
            LogUtils.error('This command only works inside a tmux environment.');
            LogUtils.warn('Please run this command inside tmux.');
            return { shouldQuit: false, runApiCall: false };
        }

        const editor = process.env.EDITOR || 'nano';
        const randomSuffix = randomBytes(4).toString('hex');
        const tempFile = TempFileUtils.createTempFile(`aicoder-memory-${randomSuffix}`, '.json');

        try {
            const messages = this.context.messageHistory.getMessages();

            await JsonUtils.writeFile(tempFile, messages as unknown);
            LogUtils.print(`Exported ${messages.length} messages to ${tempFile}`, {
                color: Config.colors.cyan,
            });

            LogUtils.print(`Opening ${editor} in tmux window...`, { color: Config.colors.cyan });
            LogUtils.print(
                'Save and exit when done. The editor is running in a separate tmux window.',
                { color: Config.colors.dim }
            );

            const syncPoint = `memory_done_${randomSuffix}`;
            const windowName = `memory_${randomSuffix}`;

            const tmuxCmd = `tmux new-window -n "${windowName}" 'bash -c "${editor} ${tempFile}; tmux wait-for -S ${syncPoint}"'`;

            await new Promise<void>((resolve, reject) => {
                exec(tmuxCmd, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
            await new Promise<void>((resolve, reject) => {
                exec(`tmux wait-for ${syncPoint}`, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            if (!(await FileUtils.fileExistsAsync(tempFile))) {
                LogUtils.error(`Session file not found after editing`);
                return { shouldQuit: false, runApiCall: false };
            }

            const file = Bun.file(tempFile);
            const editedMessages = JSON.parse(await file.text());

            if (Array.isArray(editedMessages)) {
                this.context.messageHistory.clear();

                for (const msg of editedMessages) {
                    switch (msg.role) {
                        case 'system':
                            this.context.messageHistory.addSystemMessage(msg.content || '');
                            break;
                        case 'user':
                            this.context.messageHistory.addUserMessage(msg.content || '');
                            break;
                        case 'assistant':
                            this.context.messageHistory.addAssistantMessage({
                                content: msg.content,
                                tool_calls: msg.tool_calls,
                            });
                            break;
                        case 'tool':
                            this.context.messageHistory.addToolResults([
                                {
                                    content: msg.content,
                                    tool_call_id: msg.tool_call_id,
                                },
                            ]);
                            break;
                        default:
                            LogUtils.warn(
                                `Warning: Unknown message role '${msg.role}', treating as user`
                            );
                            this.context.messageHistory.addUserMessage(msg.content || '');
                    }
                }

                LogUtils.success(`Reloaded ${editedMessages.length} messages from editor`);
            } else {
                LogUtils.error(`Invalid session file format`);
            }

            try {
                unlinkSync(tempFile);
            } catch {}
        } catch (error) {
            LogUtils.error(`Memory edit failed: ${error}`);
            try {
                unlinkSync(tempFile);
            } catch {}
        }

        return { shouldQuit: false, runApiCall: false };
    }

    private showUsage(): void {
        const colors = Config.colors;
        LogUtils.print('Memory command usage:', { color: colors.cyan });
        LogUtils.print('  /memory                         - Edit conversation in $EDITOR (original behavior)', { color: colors.white });
        LogUtils.print('  /memory inject <file>             - Inject specific memory file', { color: colors.white });
        LogUtils.print('  /memory remind [file]             - Reinforce behavioral memory', { color: colors.white });
        LogUtils.print('  /memory list                      - List available memory files', { color: colors.white });
        LogUtils.print('', { color: colors.white });
        LogUtils.print('Examples:', { color: colors.cyan });
        LogUtils.print('  /memory                           - Open conversation in editor', { color: colors.white });
        LogUtils.print('  /memory inject _debug             - Inject debug_session_reset.json', { color: colors.white });
        LogUtils.print('  /memory remind                     - Reinforce all behavioral memories', { color: colors.white });
    }

    private async handleInject(args: string[], memoryManager: MemoryManager): Promise<CommandResult> {
        if (args.length === 0) {
            LogUtils.error('Usage: /memory inject <filename>');
            return { shouldQuit: false, runApiCall: false };
        }

        const fileName = args[0];
        
        // Check if file exists
        const fileExists = await memoryManager.memoryFileExists(fileName);
        if (!fileExists) {
            LogUtils.error(`Memory file not found: ${fileName}`);
            
            // Show available files
            const availableFiles = await memoryManager.listMemoryFiles();
            if (availableFiles.length > 0) {
                LogUtils.print('Available memory files:', { color: Config.colors.cyan });
                for (const file of availableFiles) {
                    LogUtils.print(`  - ${file.replace('.json', '')}`, { color: Config.colors.white });
                }
            }
            
            return { shouldQuit: false, runApiCall: false };
        }

        // Load and inject memories
        const messages = await memoryManager.loadSpecificMemory(fileName);
        if (messages.length === 0) {
            LogUtils.error(`No valid messages found in: ${fileName}`);
            return { shouldQuit: false, runApiCall: false };
        }

        // Inject into message history
        for (const message of messages) {
            if (message.role === 'user') {
                this.context.messageHistory.addUserMessage(message.content);
            } else if (message.role === 'assistant') {
                this.context.messageHistory.addAssistantMessage({
                    content: message.content,
                    tool_calls: []
                });
            }
        }

        LogUtils.success(`Injected ${messages.length} memory messages from ${fileName}`);
        return { shouldQuit: false, runApiCall: false };
    }

    private async handleRemind(args: string[], memoryManager: MemoryManager): Promise<CommandResult> {
        let messages: any[] = [];

        if (args.length > 0) {
            // Remind specific file
            const fileName = args[0];
            const fileExists = await memoryManager.memoryFileExists(fileName);
            
            if (!fileExists) {
                LogUtils.error(`Memory file not found: ${fileName}`);
                return { shouldQuit: false, runApiCall: false };
            }

            messages = await memoryManager.loadSpecificMemory(fileName);
            LogUtils.print(`Reinforcing memory from: ${fileName}`, { color: Config.colors.cyan });
        } else {
            // Remind all auto-loaded files
            messages = await memoryManager.loadAutoLoadMemories();
            LogUtils.print('Reinforcing all behavioral memories', { color: Config.colors.cyan });
        }

        if (messages.length === 0) {
            LogUtils.warn('No memory messages to reinforce');
            return { shouldQuit: false, runApiCall: false };
        }

        // Inject into message history
        for (const message of messages) {
            if (message.role === 'user') {
                this.context.messageHistory.addUserMessage(message.content);
            } else if (message.role === 'assistant') {
                this.context.messageHistory.addAssistantMessage({
                    content: message.content,
                    tool_calls: []
                });
            }
        }

        LogUtils.success(`Reinforced ${messages.length} behavioral memory messages`);
        return { shouldQuit: false, runApiCall: false };
    }

    private async handleList(memoryManager: MemoryManager): Promise<CommandResult> {
        const files = await memoryManager.listMemoryFiles();
        
        if (files.length === 0) {
            LogUtils.print('No memory files found in .aicoder/memory/', { color: Config.colors.yellow });
            return { shouldQuit: false, runApiCall: false };
        }

        LogUtils.print('Available memory files:', { color: Config.colors.cyan });
        
        const numberedFiles = files.filter(file => file.match(/^\d+_.*\.json$/));
        const otherFiles = files.filter(file => !file.match(/^\d+_.*\.json$/));

        if (numberedFiles.length > 0) {
            LogUtils.print('\nAuto-load files:', { color: Config.colors.green });
            numberedFiles.sort((a, b) => {
                const aNum = parseInt(a.match(/^(\d+)_/)![1]);
                const bNum = parseInt(b.match(/^(\d+)_/)![1]);
                return aNum - bNum;
            });
            
            for (const file of numberedFiles) {
                const name = file.replace('.json', '');
                LogUtils.print(`  - ${name}`, { color: Config.colors.white });
            }
        }

        if (otherFiles.length > 0) {
            LogUtils.print('\nManual files:', { color: Config.colors.yellow });
            for (const file of otherFiles) {
                const name = file.replace('.json', '');
                LogUtils.print(`  - ${name}`, { color: Config.colors.white });
            }
        }

        return { shouldQuit: false, runApiCall: false };
    }
}