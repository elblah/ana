import { BaseCommand, type CommandResult } from './base.js';
import { Config } from '../config.js';
import { LogUtils } from '../../utils/log-utils.js';

export class ResetCommand extends BaseCommand {
    protected name = 'reset';
    protected description = 'Reset the entire session';

    execute(): CommandResult {
        this.context.messageHistory.clear();
        this.context.stats.reset();
        LogUtils.success('Session reset. Starting fresh.');
        return { shouldQuit: false, runApiCall: false };
    }
}
