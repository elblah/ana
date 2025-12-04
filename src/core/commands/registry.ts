import { BaseCommand, type CommandContext, type CommandResult } from './base.js';
import { LogUtils } from '../../utils/log-utils.js';
import { HelpCommand } from './help.js';
import { QuitCommand } from './quit.js';
import { ClearCommand } from './clear.js';
import { StatsCommand } from './stats.js';
import { ResetCommand } from './reset.js';
import { SaveCommand } from './save.js';
import { LoadCommand } from './load.js';
import { CompactCommand } from './compact.js';
import { SandboxCommand } from './sandbox.js';
import { EditCommand } from './edit.js';
import { ModelCommand, ModelBackCommand } from './model.js';
import { RetryCommand } from './retry.js';
import { MemoryCommand } from './memory.js';
import { YoloCommand } from './yolo.js';
import { DetailCommand } from './detail.js';
import { SnippetsCommand } from './snippets.js';
import { CouncilCommand } from './council.js';
import { Config } from '../config.js';

export class CommandRegistry {
    public commands: Map<string, BaseCommand> = new Map();
    private aliases: Map<string, string> = new Map();

    constructor(context: CommandContext) {
        // Register all commands
        const helpCmd = new HelpCommand(context);
        const quitCmd = new QuitCommand(context);
        const clearCmd = new ClearCommand(context);
        const statsCmd = new StatsCommand(context);
        const resetCmd = new ResetCommand(context);
        const saveCmd = new SaveCommand(context);
        const loadCmd = new LoadCommand(context);
        const compactCmd = new CompactCommand(context);
        const sandboxCmd = new SandboxCommand(context);
        const editCmd = new EditCommand(context);
        const retryCmd = new RetryCommand(context);
        const memoryCmd = new MemoryCommand(context);
        const yoloCmd = new YoloCommand(context);
        const detailCmd = new DetailCommand(context);
        const snippetsCmd = new SnippetsCommand(context);
        const councilCmd = new CouncilCommand(context);
        const modelCmd = new ModelCommand(context);
        const modelBackCmd = new ModelBackCommand(context);

        this.registerCommand(helpCmd);
        this.registerCommand(quitCmd);
        this.registerCommand(clearCmd);
        this.registerCommand(statsCmd);
        this.registerCommand(resetCmd);
        this.registerCommand(saveCmd);
        this.registerCommand(loadCmd);
        this.registerCommand(compactCmd);
        this.registerCommand(sandboxCmd);
        this.registerCommand(councilCmd);
        this.registerCommand(editCmd);
        this.registerCommand(modelCmd);
        this.registerCommand(modelBackCmd);
        this.registerCommand(retryCmd);
        this.registerCommand(memoryCmd);
        this.registerCommand(snippetsCmd);
        this.registerCommand(yoloCmd);
        this.registerCommand(detailCmd);
    }

    /**
     * Register a command
     */
    private registerCommand(command: BaseCommand) {
        const name = command.getName();
        this.commands.set(name, command);

        // Register aliases
        command.getAliases().forEach((alias) => {
            this.aliases.set(alias, name);
        });
    }

    /**
     * Register a plugin command with a simple handler function
     */
    registerPluginCommand(
        name: string,
        handler: (args: string[]) => boolean | void,
        description = 'Plugin command'
    ): void {
        // Strip leading slash if present
        const cmdName = name.startsWith('/') ? name.slice(1) : name;

        // Create a simple wrapper command class
        class PluginCommand extends BaseCommand {
            protected name = cmdName;
            protected description = description;

            execute(args: string[]): Promise<CommandResult> {
                const result = handler(args);
                return Promise.resolve({
                    shouldQuit: false,
                    runApiCall: false,
                    message: typeof result === 'string' ? result : undefined,
                });
            }
        }

        // Create a dummy context for plugin commands
        const dummyContext = {} as CommandContext;
        const pluginCommand = new PluginCommand(dummyContext);

        this.commands.set(cmdName, pluginCommand);
    }

    listCommands(): { name: string; description: string }[] {
        return Array.from(this.commands.values()).map((cmd) => ({
            name: cmd.getName(),
            description: cmd.getDescription(),
        }));
    }

    /**
     * Execute a command by name
     */
    async executeCommand(commandLine: string): Promise<CommandResult> {
        // Split command and arguments
        const parts = commandLine.trim().split(/\s+/);
        const commandName = parts[0].toLowerCase();
        const args = parts.slice(1);

        // Handle alias
        const actualCommand =
            this.aliases.get(commandName.startsWith('/') ? commandName.slice(1) : commandName) ||
            commandName;

        // Remove leading slash if present
        const cmdName = actualCommand.startsWith('/') ? actualCommand.slice(1) : actualCommand;

        // Find and execute command
        const command = this.commands.get(cmdName);
        if (!command) {
            LogUtils.error(`Unknown command: ${commandLine}`);
            console.log(
                `Type ${Config.colors.green}/help${Config.colors.reset} to see available commands.`
            );
            return { shouldQuit: false, runApiCall: false };
        }

        try {
            return await command.execute(args);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            LogUtils.error(`Error executing command: ${errorMessage}`);
            return { shouldQuit: false, runApiCall: false };
        }
    }
}
