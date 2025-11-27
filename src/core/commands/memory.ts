/**
 * Memory command - Export conversation JSON to temp file, edit with $EDITOR, then reload
 */

import { BaseCommand, type CommandResult } from './base.js';
import { Config } from '../config.js';
import { LogUtils } from '../../utils/log-utils.js';
import { FileUtils } from '../../utils/file-utils.js';
import { unlinkSync } from 'node:fs';
import { exec } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { TempFileUtils } from '../../utils/temp-file-utils.js';
import { JsonUtils } from '../../utils/json-utils.js';

export class MemoryCommand extends BaseCommand {
    protected name = 'memory';
    protected description = 'Edit conversation memory in $EDITOR';

    getAliases(): string[] {
        return ['m'];
    }

    async execute(args: string[]): Promise<CommandResult> {
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
}
