import { MessageHistory } from '../message-history.js';
import { InputHandler } from '../input-handler.js';
import { Stats } from '../stats.js';

export interface CommandContext {
  messageHistory: MessageHistory;
  inputHandler: InputHandler;
  stats: Stats;
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