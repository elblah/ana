import { BaseCommand, type CommandResult, CommandContext } from './base.js';
import { Config } from '../config.js';
import { FileUtils } from '../../utils/file-utils.js';
import { LogUtils } from '../../utils/log-utils.js';
import { JsonUtils } from '../../utils/json-utils.js';
import { JsonlUtils } from '../../utils/jsonl-utils.js';

export class LoadCommand extends BaseCommand {
    protected name = 'load';
    protected description = 'Load session from file';

    async execute(args: string[]): Promise<CommandResult> {
        const filename = args[0] || 'session.json';

        try {
            if (!(await FileUtils.fileExistsAsync(filename))) {
                LogUtils.error(`Session file not found: ${filename}`);
                return { shouldQuit: false, runApiCall: false };
            }

            let messages: any[] = [];

            // Check file extension to determine format
            if (filename.endsWith('.jsonl')) {
                // Load as JSONL format
                messages = await JsonlUtils.readFile(filename);
            } else {
                // Load as JSON format (existing behavior)
                const sessionData = await JsonUtils.readFile(filename);
                // Handle both formats: direct array of messages or object with messages property
                messages = Array.isArray(sessionData) ? sessionData : sessionData.messages;
            }

            if (messages && Array.isArray(messages)) {
                this.context.messageHistory.setMessages(messages);
                LogUtils.success(`Session loaded from ${filename}`);
            } else {
                LogUtils.error(`Invalid session file format`);
            }
        } catch (error) {
            LogUtils.error(`Error loading session: ${error}`);
        }

        return { shouldQuit: false, runApiCall: false };
    }
}
