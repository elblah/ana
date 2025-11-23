import { BaseCommand, type CommandResult } from './base.js';
import { Config } from '../config.js';

const colors = Config.colors;

export class SandboxCommand extends BaseCommand {
    protected name = 'sandbox-fs';
    protected description = 'Show or configure filesystem sandbox status';

    execute(args: string[]): CommandResult {
        const status = Config.sandboxDisabled ? 'DISABLED' : 'ENABLED';
        const statusColor = Config.sandboxDisabled ? Config.colors.red : Config.colors.green;

        if (args.length === 0) {
            // Show status
            console.log(
                colors.bold +
                    'sandbox-fs Status:' +
                    colors.reset +
                    ' ' +
                    statusColor +
                    status +
                    colors.reset
            );
            console.log(colors.cyan + 'Current directory: ' + process.cwd() + colors.reset);

            if (Config.sandboxDisabled) {
                console.log(
                    colors.yellow +
                        'Sandbox-fs is disabled via MINI_SANDBOX=0 environment variable' +
                        colors.reset
                );
                console.log(
                    colors.yellow +
                        'File operations can access any path on the system' +
                        colors.reset
                );
            } else {
                console.log(
                    colors.green + 'Sandbox-fs is enforcing path restrictions' + colors.reset
                );
                console.log(
                    colors.green +
                        'File operations for internal tools are limited to current directory and subdirectories' +
                        colors.reset
                );
            }

            console.log(colors.dim + 'To disable sandbox-fs: export MINI_SANDBOX=0' + colors.reset);
            console.log(
                colors.dim +
                    'To enable sandbox-fs: unset MINI_SANDBOX or export MINI_SANDBOX=1' +
                    colors.reset
            );

            return { shouldQuit: false, runApiCall: false };
        }

        const action = args[0].toLowerCase();
        if (action === 'on' || action === '1') {
            if (Config.sandboxDisabled && process.env.MINI_SANDBOX === '0') {
                console.log(
                    `${Config.colors.yellow}Sandbox-fs disabled via MINI_SANDBOX=0 environment variable${Config.colors.reset}`
                );
                console.log(
                    `${Config.colors.cyan}To enable, restart without MINI_SANDBOX=0:${Config.colors.reset}`
                );
                console.log(`${Config.colors.cyan}  unset MINI_SANDBOX${Config.colors.reset}`);
                console.log(`${Config.colors.cyan}  aicoder-mini${Config.colors.reset}`);
            } else if (Config.sandboxDisabled) {
                Config.setSandboxDisabled(false);
            } else {
                console.log(
                    `${Config.colors.yellow}Sandbox-fs is already enabled${Config.colors.reset}`
                );
            }
        } else if (action === 'off' || action === '0') {
            if (Config.sandboxDisabled) {
                console.log(
                    `${Config.colors.red}Sandbox-fs is already disabled${Config.colors.reset}`
                );
            } else {
                Config.setSandboxDisabled(true);
            }
        } else {
            console.log(
                `${Config.colors.red}Invalid argument. Use: /sandbox-fs [on|off]${Config.colors.reset}`
            );
        }

        return { shouldQuit: false, runApiCall: false };
    }
}
