import { BaseCommand, type CommandResult } from './base.js';
import { Config } from '../config.js';
import { JsonUtils } from '../../utils/json-utils.js';
import { LogUtils } from '../../utils/log-utils.js';

export class SaveCommand extends BaseCommand {
    protected name = 'save';
    protected description = 'Save current session to file';

    async execute(args: string[]): Promise<CommandResult> {
        const filename = args[0] || 'session.json';

        try {
            const sessionData = this.context.messageHistory.getMessages();

            await JsonUtils.writeFile(filename, sessionData as unknown);
            LogUtils.success(`Session saved to ${filename}`);
        } catch (error) {
            LogUtils.error(`Error saving session: ${error}`);
        }

        return { shouldQuit: false, runApiCall: false };
    }
}
