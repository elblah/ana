import { BaseCommand, type CommandResult } from './base.js';
import { Config } from '../config.js';

const colors = Config.colors;

export class YoloCommand extends BaseCommand {
    protected name = 'yolo';
    protected description = 'Show or configure YOLO mode (auto-approve tool actions)';

    execute(args: string[]): CommandResult {
        const status = Config.yoloMode ? 'ENABLED' : 'DISABLED';
        const statusColor = Config.yoloMode ? Config.colors.green : Config.colors.red;

        if (args.length === 0) {
            // Show status
            console.log(
                colors.bold +
                    'YOLO Mode Status:' +
                    colors.reset +
                    ' ' +
                    statusColor +
                    status +
                    colors.reset
            );

            if (Config.yoloMode) {
                console.log(colors.green + 'All tool actions will be auto-approved' + colors.reset);
                console.log(
                    colors.yellow +
                        colors.bold +
                        '[!] This includes run_shell_command - use with caution!' +
                        colors.reset
                );
            } else {
                console.log(colors.red + 'Tool actions require explicit approval' + colors.reset);
                console.log(
                    colors.green +
                        'Safe mode - you will be prompted before each action' +
                        colors.reset
                );
            }

            console.log(
                colors.dim + 'To enable YOLO: /yolo on or export YOLO_MODE=1' + colors.reset
            );
            console.log(
                colors.dim + 'To disable YOLO: /yolo off or unset YOLO_MODE' + colors.reset
            );

            return { shouldQuit: false, runApiCall: false };
        }

        const action = args[0].toLowerCase();
        if (action === 'on' || action === '1') {
            if (Config.yoloMode) {
                console.log(`${colors.yellow}YOLO mode is already enabled${colors.reset}`);
            } else {
                Config.setYoloMode(true);
                console.log(
                    `${colors.green}YOLO mode ENABLED - All tool actions will auto-approve${colors.reset}`
                );
                console.log(
                    `${colors.yellow}${colors.bold}[!] This includes potentially dangerous shell commands${colors.reset}`
                );
            }
        } else if (action === 'off' || action === '0') {
            if (Config.yoloMode) {
                Config.setYoloMode(false);
                console.log(
                    `${colors.red}YOLO mode DISABLED - Tool actions require approval${colors.reset}`
                );
                console.log(
                    `${colors.green}Safe mode restored - you will be prompted for each action${colors.reset}`
                );
            } else {
                console.log(`${colors.red}YOLO mode is already disabled${colors.reset}`);
            }
        } else {
            console.log(`${colors.red}Invalid argument. Use: /yolo [on|off]${colors.reset}`);
        }

        return { shouldQuit: false, runApiCall: false };
    }
}
