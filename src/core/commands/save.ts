import { BaseCommand, type CommandResult } from './base.js';
import { Config } from '../config.js';
import { JsonUtils } from '../../utils/json-utils.js';
import { JsonlUtils } from '../../utils/jsonl-utils.js';
import { LogUtils } from '../../utils/log-utils.js';

export class SaveCommand extends BaseCommand {
    protected name = 'save';
    protected description = 'Save current session to file';

    async execute(args: string[]): Promise<CommandResult> {
        const filename = args[0] || 'session.json';

        try {
            const messages = this.context.messageHistory.getMessages();

            // Check file extension to determine format
            if (filename.endsWith('.jsonl')) {
                // Save as JSONL format
                await JsonlUtils.writeMessages(filename, messages);
            } else {
                // Save as JSON format (existing behavior)
                await JsonUtils.writeFile(filename, messages as unknown);
            }

            LogUtils.success(`Session saved to ${filename}`);
        } catch (error) {
            LogUtils.error(`Error saving session: ${error}`);
        }

        return { shouldQuit: false, runApiCall: false };
    }
}
