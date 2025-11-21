import { BaseCommand, CommandResult } from './base.js';
import { Config } from '../config.js';

export class ResetCommand extends BaseCommand {
  protected name = 'reset';
  protected description = 'Reset the entire session';

  execute(): CommandResult {
    this.context.messageHistory.clear();
    this.context.stats.reset();
    console.log(`${Config.colors.green}Session reset. Starting fresh.${Config.colors.reset}`);
    return { shouldQuit: false, runApiCall: false };
  }
}