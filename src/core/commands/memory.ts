/**
 * Memory command - Export conversation JSON to temp file, edit with $EDITOR, then reload
 */

import { BaseCommand, type CommandResult } from './base.js';
import { Config } from '../config.js';
import { unlinkSync } from 'node:fs';
import { exec } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { TempUtils } from '../temp-utils.js';

export class MemoryCommand extends BaseCommand {
    protected name = 'memory';
    protected description = 'Edit conversation memory in $EDITOR';

    getAliases(): string[] {
        return ['m'];
    }

    async execute(args: string[]): Promise<CommandResult> {
        if (!process.env.TMUX) {
            console.log(
                `${Config.colors.red}This command only works inside a tmux environment.${Config.colors.reset}`
            );
            console.log(
                `${Config.colors.yellow}Please run this command inside tmux.${Config.colors.reset}`
            );
            return { shouldQuit: false, runApiCall: false };
        }

        const editor = process.env.EDITOR || 'nano';
        const randomSuffix = randomBytes(4).toString('hex');
        const tempFile = TempUtils.createTempFile(`aicoder-memory-${randomSuffix}`, '.json');

        try {
            const messages = this.context.messageHistory.getMessages();

            await Bun.write(tempFile, JSON.stringify(messages, null, 2));
            console.log(
                `${Config.colors.cyan}Exported ${messages.length} messages to ${tempFile}${Config.colors.reset}`
            );

            console.log(
                `${Config.colors.cyan}Opening ${editor} in tmux window...${Config.colors.reset}`
            );
            console.log(
                `${Config.colors.dim}Save and exit when done. The editor is running in a separate tmux window.${Config.colors.reset}`
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

            const file = Bun.file(tempFile);
            if (!file.exists()) {
                console.log(
                    `${Config.colors.red}Session file not found after editing${Config.colors.reset}`
                );
                return { shouldQuit: false, runApiCall: false };
            }

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
                            console.log(
                                `${Config.colors.yellow}Warning: Unknown message role '${msg.role}', treating as user${Config.colors.reset}`
                            );
                            this.context.messageHistory.addUserMessage(msg.content || '');
                    }
                }

                console.log(
                    `${Config.colors.green}Reloaded ${editedMessages.length} messages from editor${Config.colors.reset}`
                );
            } else {
                console.log(
                    `${Config.colors.red}Invalid session file format${Config.colors.reset}`
                );
            }

            try {
                unlinkSync(tempFile);
            } catch {}
        } catch (error) {
            console.log(`${Config.colors.red}Memory edit failed: ${error}${Config.colors.reset}`);
            try {
                unlinkSync(tempFile);
            } catch {}
        }

        return { shouldQuit: false, runApiCall: false };
    }
}
