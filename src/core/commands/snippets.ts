import { BaseCommand, type CommandResult } from './base.js';
import { getSnippetNames, loadSnippet, ensureSnippetsDir, SNIPPETS_DIR } from '../snippet-utils.js';
import { Config } from '../config.js';
import { LogUtils } from '../../utils/log-utils.js';

export class SnippetsCommand extends BaseCommand {
    protected name = 'snippets';
    protected description = 'Manage prompt snippets';

    execute(args: string[]): CommandResult {
        if (args.length === 0) {
            this.showUsage();
            return { shouldQuit: false, runApiCall: false };
        }

        const subcommand = args[0].toLowerCase();

        switch (subcommand) {
            case 'list':
                return this.listSnippets();
            case 'show':
                return this.showSnippet(args[1]);
            case 'path':
                return this.showPath();
            default:
                LogUtils.error(`[!] Unknown subcommand: ${subcommand}`);
                this.showUsage();
                return { shouldQuit: false, runApiCall: false };
        }
    }

    private showUsage(): void {
        LogUtils.print('Usage: /snippets <command>', { color: Config.colors.cyan });
        LogUtils.print('Commands:', { color: Config.colors.cyan });
        LogUtils.print('  list    - List all available snippets', { color: Config.colors.green });
        LogUtils.print('  show    <name> - Show snippet content', { color: Config.colors.green });
        LogUtils.print('  path    - Show snippets directory path', { color: Config.colors.green });
    }

    private listSnippets(): CommandResult {
        const names = getSnippetNames();

        if (names.length === 0) {
            LogUtils.warn('[!] No snippets found');
            LogUtils.print('Create .txt files in ~/.config/aicoder-mini/snippets/', {
                color: Config.colors.dim,
            });
        } else {
            LogUtils.print('Available snippets:', { color: Config.colors.cyan });
            names.forEach((name) => {
                LogUtils.print(`  ${name}`, { color: Config.colors.green });
            });
        }

        return { shouldQuit: false, runApiCall: false };
    }

    private showSnippet(name: string): CommandResult {
        if (!name) {
            LogUtils.error('[!] Missing snippet name');
            LogUtils.print('Usage: /snippets show <name>', { color: Config.colors.cyan });
            return { shouldQuit: false, runApiCall: false };
        }

        const content = loadSnippet(name);
        if (content !== null) {
            LogUtils.print(`Snippet '@${name}':`, { color: Config.colors.cyan });
            LogUtils.print(content, { color: Config.colors.dim });
        } else {
            LogUtils.error(`[!] Snippet '${name}' not found`);
        }

        return { shouldQuit: false, runApiCall: false };
    }

    private showPath(): CommandResult {
        ensureSnippetsDir();
        LogUtils.print('Snippets directory:', { color: Config.colors.cyan });
        LogUtils.print(`  ${SNIPPETS_DIR}`, { color: Config.colors.green });
        return { shouldQuit: false, runApiCall: false };
    }
}
