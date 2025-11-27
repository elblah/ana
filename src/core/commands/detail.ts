/**
 * Detail command implementation
 */

import { BaseCommand, type CommandResult, type CommandContext } from './base.js';
import { Config } from '../config.js';
import { LogUtils } from '../../utils/log-utils.js';

export class DetailCommand extends BaseCommand {
    protected name = 'detail';
    protected description = 'Toggle detailed tool output on/off';

    constructor(context: CommandContext) {
        super(context);
    }

    execute(args: string[]): CommandResult {
        const status = Config.detailMode ? 'ENABLED' : 'DISABLED';
        const statusColor = Config.detailMode ? Config.colors.green : Config.colors.yellow;

        if (args.length === 0) {
            // Show status
            LogUtils.print(`Detail Mode Status: ${status}`, {
                color: statusColor,
                bold: true,
            });

            if (Config.detailMode) {
                LogUtils.success('All tool parameters and results will be shown');
                LogUtils.print('Use Ctrl+Z or /detail off to switch to simple mode', {
                    color: Config.colors.cyan,
                });
            } else {
                LogUtils.warn('Only important tool information will be shown');
                LogUtils.print('Use Ctrl+Z or /detail on to switch to detailed mode', {
                    color: Config.colors.cyan,
                });
            }

            LogUtils.print('Quick toggle: Ctrl+Z | Command: /detail [on|off]', {
                color: Config.colors.dim,
            });
            return { shouldQuit: false, runApiCall: false };
        }

        const action = args[0].toLowerCase();
        if (action === 'on' || action === '1' || action === 'enable' || action === 'true') {
            if (Config.detailMode) {
                LogUtils.warn(`[*] Detail mode is already enabled`);
            } else {
                Config.detailMode = true;
                LogUtils.success('[*] Detail mode ENABLED');
                LogUtils.print('All tool parameters and results will now be shown', {
                    color: Config.colors.cyan,
                });
            }
        } else if (
            action === 'off' ||
            action === '0' ||
            action === 'disable' ||
            action === 'false'
        ) {
            if (Config.detailMode) {
                Config.detailMode = false;
                LogUtils.warn('[*] Detail mode DISABLED');
                LogUtils.print('Only important tool information will be shown', {
                    color: Config.colors.cyan,
                });
            } else {
                LogUtils.warn('[*] Detail mode is already disabled');
            }
        } else if (action === 'toggle') {
            Config.detailMode = !Config.detailMode;
            const newStatus = Config.detailMode ? 'ENABLED' : 'DISABLED';

            if (Config.detailMode) {
                LogUtils.success(`[*] Detail mode ENABLED`);
                LogUtils.print('All tool parameters and results will now be shown', {
                    color: Config.colors.cyan,
                });
            } else {
                LogUtils.warn(`[*] Detail mode DISABLED`);
                LogUtils.print('Only important tool information will be shown', {
                    color: Config.colors.cyan,
                });
            }
        } else {
            LogUtils.error('Invalid argument. Use: /detail [on|off|toggle]');
            LogUtils.print('  /detail - Show current status', { color: Config.colors.dim });
            LogUtils.print('  /detail on - Enable detailed output', { color: Config.colors.dim });
            LogUtils.print('  /detail off - Disable detailed output', { color: Config.colors.dim });
            LogUtils.print('  /detail toggle - Toggle current state', { color: Config.colors.dim });
            LogUtils.print('  Ctrl+Z - Quick toggle', { color: Config.colors.dim });
        }

        return { shouldQuit: false, runApiCall: false };
    }

    examples(): string[] {
        return [
            '/detail - Show current detail mode status',
            '/detail on - Enable detailed tool output',
            '/detail off - Disable detailed output (show friendly messages)',
            '/detail toggle - Toggle between on/off',
            'Ctrl+Z - Quick toggle detail mode',
        ];
    }
}
