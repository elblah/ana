import { BaseCommand, type CommandResult } from './base.js';
import { Config } from '../config.js';
import { LogUtils } from '../../utils/log-utils.js';

export class SandboxCommand extends BaseCommand {
    protected name = 'sandbox-fs';
    protected description = 'Show or configure filesystem sandbox status';

    execute(args: string[]): CommandResult {
        const status = Config.sandboxDisabled ? 'DISABLED' : 'ENABLED';
        const statusColor = Config.sandboxDisabled ? Config.colors.red : Config.colors.green;

        if (args.length === 0) {
            // Show status
            LogUtils.print(`sandbox-fs Status: ${status}`, { color: statusColor, bold: true });
            LogUtils.print(`Current directory: ${process.cwd()}`, { color: Config.colors.cyan });

            if (Config.sandboxDisabled) {
                LogUtils.warn('Sandbox-fs is disabled via MINI_SANDBOX=0 environment variable');
                LogUtils.warn('File operations can access any path on the system');
            } else {
                LogUtils.success('Sandbox-fs is enforcing path restrictions');
                LogUtils.success(
                    'File operations for internal tools are limited to current directory and subdirectories'
                );
            }

            LogUtils.print('To disable sandbox-fs: export MINI_SANDBOX=0', {
                color: Config.colors.dim,
            });
            LogUtils.print('To enable sandbox-fs: unset MINI_SANDBOX or export MINI_SANDBOX=1', {
                color: Config.colors.dim,
            });

            return { shouldQuit: false, runApiCall: false };
        }

        const action = args[0].toLowerCase();
        if (action === 'on' || action === '1') {
            if (Config.sandboxDisabled && process.env.MINI_SANDBOX === '0') {
                LogUtils.warn(`Sandbox-fs disabled via MINI_SANDBOX=0 environment variable`);
                LogUtils.print(`To enable, restart without MINI_SANDBOX=0:`, {
                    color: Config.colors.cyan,
                });
                LogUtils.print(`  unset MINI_SANDBOX`, { color: Config.colors.cyan });
                LogUtils.print(`  aicoder-mini`, { color: Config.colors.cyan });
            } else if (Config.sandboxDisabled) {
                Config.setSandboxDisabled(false);
            } else {
                LogUtils.warn(`Sandbox-fs is already enabled`);
            }
        } else if (action === 'off' || action === '0') {
            if (Config.sandboxDisabled) {
                LogUtils.error(`Sandbox-fs is already disabled`);
            } else {
                Config.setSandboxDisabled(true);
            }
        } else {
            LogUtils.error(`Invalid argument. Use: /sandbox-fs [on|off]`);
        }

        return { shouldQuit: false, runApiCall: false };
    }
}
