import { BaseCommand, CommandResult } from './base.js';
import { Config } from '../config.js';

export class QuitCommand extends BaseCommand {
  protected name = 'quit';
  protected description = 'Exit the application';

  getAliases(): string[] {
    return ['q', 'x'];
  }

  execute(): CommandResult {
    console.log(`${Config.colors.yellow}Goodbye!${Config.colors.reset}`);
    return { shouldQuit: true, runApiCall: false };
  }
}