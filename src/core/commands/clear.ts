import { BaseCommand, type CommandResult } from './base.js';
import { Config } from '../config.js';
import { LogUtils } from '../../utils/log-utils.js';

export class ClearCommand extends BaseCommand {
    protected name = 'clear';
    protected description = 'Clear the conversation history';

    execute(): CommandResult {
        console.clear();
        this.context.messageHistory.clear();
        LogUtils.success('Conversation history cleared.');
        return { shouldQuit: false, runApiCall: false };
    }
}
