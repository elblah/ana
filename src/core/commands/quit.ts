import { BaseCommand, type CommandResult } from './base.js';
import { Config } from '../config.js';
import { LogUtils } from '../../utils/log-utils.js';

export class QuitCommand extends BaseCommand {
    protected name = 'quit';
    protected description = 'Exit the application';

    getAliases(): string[] {
        return ['q', 'x'];
    }

    execute(): CommandResult {
        LogUtils.success('Goodbye!');
        return { shouldQuit: true, runApiCall: false };
    }
}
