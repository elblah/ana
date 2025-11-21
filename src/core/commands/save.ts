import { BaseCommand, CommandResult } from './base.js';
import { Config } from '../config.js';

export class SaveCommand extends BaseCommand {
  protected name = 'save';
  protected description = 'Save current session to file';

  async execute(args: string[]): Promise<CommandResult> {
    const filename = args[0] || 'session.json';

    try {
      const sessionData = this.context.messageHistory.getMessages();

      await Bun.write(filename, JSON.stringify(sessionData, null, 2));
      console.log(`${Config.colors.green}Session saved to ${filename}${Config.colors.reset}`);
    } catch (error) {
      console.log(`${Config.colors.red}Error saving session: ${error}${Config.colors.reset}`);
    }

    return { shouldQuit: false, runApiCall: false };
  }
}