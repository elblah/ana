/**
 * Command handler for AI Coder - Refactored to use command registry
 */

import { Config } from './config.js';
import type { MessageHistory } from './message-history.js';
import type { InputHandler } from './input-handler.js';
import type { Stats } from './stats.js';
import { CommandRegistry } from './commands/registry.js';
import type { BaseCommand } from './commands/base.js';

// Forward declaration to avoid circular import
declare class AICoder {
    setNextPrompt(prompt: string): void;
    getNextPrompt(): string | null;
    hasNextPrompt(): boolean;
}

export interface CommandResult {
    shouldQuit: boolean;
    runApiCall: boolean;
    message?: string;
}

export interface CommandContext {
    messageHistory: MessageHistory;
    inputHandler: InputHandler;
    stats: Stats;
    commandHandler?: CommandHandler;
    aiCoder?: AICoder;
}

export class CommandHandler {
    private registry: CommandRegistry;

    constructor(messageHistory: MessageHistory, inputHandler: InputHandler, stats: Stats, aiCoder?: AICoder) {
        const context: CommandContext = {
            messageHistory,
            inputHandler,
            stats,
            aiCoder,
        };
        this.registry = new CommandRegistry(context);

        // Update context with self reference after creation
        context.commandHandler = this;
    }

    /**
     * Handle a command
     */
    async handleCommand(command: string): Promise<CommandResult> {
        return await this.registry.executeCommand(command);
    }

    /**
     * Register a new command dynamically
     */
    registerCommand(
        name: string,
        handler: (args: string[]) => boolean | undefined,
        description?: string
    ): void {
        this.registry.registerPluginCommand(name, handler, description);
    }

    /**
     * Get all commands for help display
     */
    getAllCommands(): Map<string, BaseCommand> {
        return this.registry.commands;
    }
}
