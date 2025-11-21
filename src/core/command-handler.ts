/**
 * Command handler for AI Coder - Refactored to use command registry
 */

import { Config } from './config.js';
import { MessageHistory } from './message-history.js';
import { InputHandler } from './input-handler.js';
import { Stats } from './stats.js';
import { CommandRegistry } from './commands/registry.js';

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
}

export class CommandHandler {
  private registry: CommandRegistry;

  constructor(messageHistory: MessageHistory, inputHandler: InputHandler, stats: Stats) {
    const context: CommandContext = {
      messageHistory,
      inputHandler,
      stats
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
  registerCommand(name: string, handler: (args: string[]) => boolean | void, description?: string): void {
    this.registry.registerPluginCommand(name, handler, description);
  }

  /**
   * Get all commands for help display
   */
  getAllCommands(): Map<string, any> {
    return this.registry.commands;
  }
}