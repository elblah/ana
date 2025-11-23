/**
 * Detail command implementation
 */

import { BaseCommand, type CommandResult, type CommandContext } from './base.js';
import { DetailMode } from '../detail-mode.js';
import { Config } from '../config.js';

export class DetailCommand extends BaseCommand {
    protected name = 'detail';
    protected description = 'Toggle detailed tool output on/off';

    constructor(context: CommandContext) {
        super(context);
    }

    execute(args: string[]): CommandResult {
        const status = DetailMode.getStatusText();
        const statusColor = DetailMode.enabled ? Config.colors.green : Config.colors.yellow;

        if (args.length === 0) {
            // Show status
            console.log(
                `${Config.colors.bold}Detail Mode Status:${Config.colors.reset} ${statusColor}${status}${Config.colors.reset}`
            );

            if (DetailMode.enabled) {
                console.log(
                    `${Config.colors.green}All tool parameters and results will be shown${Config.colors.reset}`
                );
                console.log(
                    `${Config.colors.cyan}Use Ctrl+Z or /detail off to switch to simple mode${Config.colors.reset}`
                );
            } else {
                console.log(
                    `${Config.colors.yellow}Only important tool information will be shown${Config.colors.reset}`
                );
                console.log(
                    `${Config.colors.cyan}Use Ctrl+Z or /detail on to switch to detailed mode${Config.colors.reset}`
                );
            }

            console.log(
                `${Config.colors.dim}Quick toggle: Ctrl+Z | Command: /detail [on|off]${Config.colors.reset}`
            );
            return { shouldQuit: false, runApiCall: false };
        }

        const action = args[0].toLowerCase();
        if (action === 'on' || action === '1' || action === 'enable' || action === 'true') {
            if (DetailMode.enabled) {
                console.log(
                    `${Config.colors.yellow}[*] Detail mode is already enabled${Config.colors.reset}`
                );
            } else {
                DetailMode.enable();
                console.log(`${Config.colors.green}[*] Detail mode ENABLED${Config.colors.reset}`);
                console.log(
                    `${Config.colors.cyan}All tool parameters and results will now be shown${Config.colors.reset}`
                );
            }
        } else if (
            action === 'off' ||
            action === '0' ||
            action === 'disable' ||
            action === 'false'
        ) {
            if (DetailMode.enabled) {
                DetailMode.disable();
                console.log(
                    `${Config.colors.yellow}[*] Detail mode DISABLED${Config.colors.reset}`
                );
                console.log(
                    `${Config.colors.cyan}Only important tool information will be shown${Config.colors.reset}`
                );
            } else {
                console.log(
                    `${Config.colors.yellow}[*] Detail mode is already disabled${Config.colors.reset}`
                );
            }
        } else if (action === 'toggle') {
            const newState = DetailMode.toggle();
            const newStatus = DetailMode.getStatusText();

            if (newState) {
                console.log(`${Config.colors.green}[*] Detail mode ENABLED${Config.colors.reset}`);
                console.log(
                    `${Config.colors.cyan}All tool parameters and results will now be shown${Config.colors.reset}`
                );
            } else {
                console.log(
                    `${Config.colors.yellow}[*] Detail mode DISABLED${Config.colors.reset}`
                );
                console.log(
                    `${Config.colors.cyan}Only important tool information will be shown${Config.colors.reset}`
                );
            }
        } else {
            console.log(
                `${Config.colors.red}Invalid argument. Use: /detail [on|off|toggle]${Config.colors.reset}`
            );
            console.log(
                `${Config.colors.dim}  /detail - Show current status${Config.colors.reset}`
            );
            console.log(
                `${Config.colors.dim}  /detail on - Enable detailed output${Config.colors.reset}`
            );
            console.log(
                `${Config.colors.dim}  /detail off - Disable detailed output${Config.colors.reset}`
            );
            console.log(
                `${Config.colors.dim}  /detail toggle - Toggle current state${Config.colors.reset}`
            );
            console.log(`${Config.colors.dim}  Ctrl+Z - Quick toggle${Config.colors.reset}`);
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
