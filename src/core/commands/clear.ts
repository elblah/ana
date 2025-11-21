import { BaseCommand, CommandResult } from './base.js';
import { Config } from '../config.js';

export class ClearCommand extends BaseCommand {
  protected name = 'clear';
  protected description = 'Clear the conversation history';

  execute(): CommandResult {
    console.clear();
    this.context.messageHistory.clear();
    console.log(`${Config.colors.green}Conversation history cleared.${Config.colors.reset}`);
    return { shouldQuit: false, runApiCall: false };
  }
}