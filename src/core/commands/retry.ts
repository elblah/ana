/**
 * Retry last message command - resends the current messages as-is
 */

import { BaseCommand } from './base.js';
import { Config } from '../config.js';

export class RetryCommand extends BaseCommand {
    protected name = 'retry';
    protected description = 'Retry the last message or configure retry behavior';

    getAliases(): string[] {
        return ['r'];
    }

    async execute(args: string[]): Promise<{ shouldQuit: boolean; runApiCall: boolean }> {
        const colors = Config.colors;

        // Handle subcommands
        if (args.length > 0) {
            const subcommand = args[0].toLowerCase();

            // Help subcommand
            if (subcommand === 'help') {
                this.showRetryHelp();
                return { shouldQuit: false, runApiCall: false };
            }

            // Auto retry subcommand
            if (subcommand === 'auto') {
                this.handleAutoRetry(args.slice(1));
                return { shouldQuit: false, runApiCall: false };
            }

            // Limit subcommand
            if (subcommand === 'limit') {
                this.handleRetryLimit(args.slice(1));
                return { shouldQuit: false, runApiCall: false };
            }

            // Backoff subcommand
            if (subcommand === 'backoff') {
                this.handleRetryBackoff(args.slice(1));
                return { shouldQuit: false, runApiCall: false };
            }

            // Unknown subcommand - treat as normal retry
            console.log(colors.yellow + '[*] Unknown retry subcommand, proceeding with normal retry...' + colors.reset);
        }

        // Check if there's at least one user message before allowing retry
        const messages = this.context.messageHistory.getMessages();
        const hasUserMessage = messages.some(msg => msg.role === 'user');

        if (!hasUserMessage) {
            console.log(colors.red + '[*] Cannot retry: No user messages found in conversation history' + colors.reset);
            console.log(colors.yellow + '[*] Retry requires at least one user message to work properly' + colors.reset);
            return { shouldQuit: false, runApiCall: false };
        }

        // Default behavior: resend last message
        console.log(colors.cyan + '[*] Retrying last request...' + colors.reset);

        // Return with runApiCall: true to trigger another API call with same messages
        // The last message will be resent exactly as it was
        return { shouldQuit: false, runApiCall: true };
    }

    private showRetryHelp(): void {
        const colors = Config.colors;
        const retryConfig = Config.getRetryConfigStatus();

        console.log(colors.brightCyan + 'Retry Configuration:' + colors.reset);
        console.log(colors.cyan + '─────────────────────────────────' + colors.reset);
        
        const autoStatus = retryConfig.autoRetry ? 'ENABLED' : 'DISABLED';
        const autoColor = retryConfig.autoRetry ? colors.green : colors.red;
        const limitText = retryConfig.maxRetries === 0 ? 'UNLIMITED' : retryConfig.maxRetries.toString();
        
        console.log(colors.white + 'Status: ' + autoColor + 'Auto Retry ' + autoStatus + colors.reset);
        console.log(colors.white + 'Max Retries: ' + colors.yellow + limitText + colors.reset);
        console.log(colors.white + 'Max Backoff: ' + colors.yellow + retryConfig.maxBackoff + ' seconds' + colors.reset);

        if (retryConfig.isRuntimeOverrides) {
            console.log(colors.yellow + 'Note: Runtime overrides are active' + colors.reset);
        }

        console.log(colors.reset);
        console.log(colors.cyan + 'Commands:' + colors.reset);
        console.log(colors.white + '/retry, /r' + colors.dim + '                - Resend last request' + colors.reset);
        console.log(colors.white + '/retry help' + colors.dim + '               - Show this configuration' + colors.reset);
        console.log(colors.white + '/retry auto on/off' + colors.dim + '        - Enable/disable automatic retry' + colors.reset);
        console.log(colors.white + '/retry limit <n>' + colors.dim + '          - Set max retry attempts (0 = unlimited)' + colors.reset);
        console.log(colors.white + '/retry backoff <n>' + colors.dim + '        - Set max backoff time in seconds' + colors.reset);

        console.log(colors.reset);
        console.log(colors.cyan + 'Environment Variables:' + colors.reset);
        console.log(colors.dim + 'MAX_RETRIES=3' + colors.white + '            - Default max retry attempts' + colors.reset);
        console.log(colors.dim + 'RETRY_MAX_WAIT=64' + colors.white + '        - Default max backoff time' + colors.reset);
    }

    private handleAutoRetry(args: string[]): void {
        const colors = Config.colors;

        if (args.length === 0) {
            const current = Config.effectiveAutoRetry;
            console.log(colors.cyan + 'Auto Retry is: ' + (current ? colors.green + 'ENABLED' : colors.red + 'DISABLED') + colors.reset);
            return;
        }

        const action = args[0].toLowerCase();
        if (action === 'on' || action === '1' || action === 'enable' || action === 'true') {
            Config.setRuntimeAutoRetry(true);
            console.log(colors.green + '[*] Auto retry ENABLED' + colors.reset);
        } else if (action === 'off' || action === '0' || action === 'disable' || action === 'false') {
            Config.setRuntimeAutoRetry(false);
            console.log(colors.yellow + '[*] Auto retry DISABLED' + colors.reset);
        } else {
            console.log(colors.red + '[*] Invalid argument. Use: /retry auto [on|off]' + colors.reset);
        }
    }

    private handleRetryLimit(args: string[]): void {
        const colors = Config.colors;

        if (args.length === 0) {
            console.log(colors.cyan + 'Current Max Retries: ' + colors.yellow + Config.effectiveMaxRetries + colors.reset);
            return;
        }

        const value = args[0];
        const numValue = Number.parseInt(value, 10);

        if (Number.isNaN(numValue) || numValue < 0) {
            console.log(colors.red + '[*] Invalid number. Use: /retry limit <number> (0 = unlimited)' + colors.reset);
            return;
        }

        Config.setRuntimeMaxRetries(numValue);
        const displayText = numValue === 0 ? 'UNLIMITED' : numValue.toString();
        console.log(colors.green + '[*] Max Retries set to: ' + colors.yellow + displayText + colors.reset);
    }

    private handleRetryBackoff(args: string[]): void {
        const colors = Config.colors;

        if (args.length === 0) {
            console.log(colors.cyan + 'Current Max Backoff: ' + colors.yellow + Config.effectiveRetryMaxWait + ' seconds' + colors.reset);
            return;
        }

        const value = args[0];
        const numValue = Number.parseInt(value, 10);

        if (Number.isNaN(numValue) || numValue < 1) {
            console.log(colors.red + '[*] Invalid number. Use: /retry backoff <seconds> (minimum: 1)' + colors.reset);
            return;
        }

        Config.setRuntimeRetryMaxWait(numValue);
        console.log(colors.green + '[*] Max Backoff set to: ' + colors.yellow + numValue + ' seconds' + colors.reset);
    }
}
