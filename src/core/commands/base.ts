import type { MessageHistory } from '../message-history.js';
import type { InputHandler } from '../input-handler.js';
import type { Stats } from '../stats.js';

// Forward declarations to avoid circular imports
export interface CommandHandler {
    getAllCommands(): Map<string, BaseCommand>;
}

declare class AICoder {
    setNextPrompt(prompt: string): void;
    getNextPrompt(): string | null;
    hasNextPrompt(): boolean;
}

export interface CommandContext {
    messageHistory: MessageHistory;
    inputHandler: InputHandler;
    stats: Stats;
    commandHandler?: CommandHandler;
    aiCoder?: AICoder;
}

export interface CommandResult {
    shouldQuit: boolean;
    runApiCall: boolean;
    message?: string;
}

export abstract class BaseCommand {
    protected abstract name: string;
    protected abstract description: string;

    constructor(protected context: CommandContext) {}

    abstract execute(args: string[]): Promise<CommandResult> | CommandResult;

    getName(): string {
        return this.name;
    }

    getDescription(): string {
        return this.description;
    }

    // Return aliases for this command (override in subclasses)
    getAliases(): string[] {
        return [];
    }
}
