/**
 * Retry last message command - resends the current messages as-is
 */

import { BaseCommand } from './base.js';
import { Config } from '../config.js';

export class RetryCommand extends BaseCommand {
    protected name = 'retry';
    protected description = 'Retry the last message by resending all current messages';

    getAliases(): string[] {
        return ['r'];
    }

    async execute(args: string[]): Promise<{ shouldQuit: boolean; runApiCall: boolean }> {
        const colors = Config.colors;

        console.log(colors.cyan + '[*] Retrying last request...' + colors.reset);

        // Return with runApiCall: true to trigger another API call with same messages
        // The last message will be resent exactly as it was
        return { shouldQuit: false, runApiCall: true };
    }
}
