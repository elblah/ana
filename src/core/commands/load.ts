import { BaseCommand, CommandResult, CommandContext } from './base.js';
import { Config } from '../config.js';

export class LoadCommand extends BaseCommand {
  protected name = 'load';
  protected description = 'Load session from file';

  async execute(args: string[]): Promise<CommandResult> {
    const filename = args[0] || 'session.json';

    try {
      const file = Bun.file(filename);
      if (!file.exists()) {
        console.log(`${Config.colors.red}Session file not found: ${filename}${Config.colors.reset}`);
        return { shouldQuit: false, runApiCall: false };
      }

      const sessionData = JSON.parse(await file.text());

      // Handle both formats: direct array of messages or object with messages property
      const messages = Array.isArray(sessionData) ? sessionData : sessionData.messages;
      
      if (messages && Array.isArray(messages)) {
        this.context.messageHistory.setMessages(messages);
        console.log(`${Config.colors.green}Session loaded from ${filename}${Config.colors.reset}`);
      } else {
        console.log(`${Config.colors.red}Invalid session file format${Config.colors.reset}`);
      }
    } catch (error) {
      console.log(`${Config.colors.red}Error loading session: ${error}${Config.colors.reset}`);
    }

    return { shouldQuit: false, runApiCall: false };
  }
}