import { BaseCommand, CommandResult, CommandContext } from './base.js';
import { Config } from '../config.js';

export class HelpCommand extends BaseCommand {
  protected name = 'help';
  protected description = 'Show this help message';

  getAliases(): string[] {
    return ['?'];
  }

  execute(): CommandResult {
    // Get commands from command handler
    const commandHandler = (this.context as any).commandHandler;
    if (!commandHandler) {
      console.log(`${Config.colors.red}Error: Command handler not available${Config.colors.reset}`);
      return { shouldQuit: false, runApiCall: false };
    }

    const commands = commandHandler.getAllCommands();
    const commandNames = Array.from(commands.keys());
    
    // Sort commands alphabetically (skip help itself)
    const sortedNames = commandNames
      .filter(name => name !== 'help')
      .sort((a, b) => a.localeCompare(b));

    // Format command list dynamically from actual command instances
    const commandList = sortedNames
      .map(name => {
        const command = commands.get(name);
        if (!command) return null;
        
        // Get command details dynamically
        const cmdName = typeof command.getName === 'function' ? command.getName() : name;
        const description = typeof command.getDescription === 'function' ? command.getDescription() : 'Unknown command';
        const aliases = typeof command.getAliases === 'function' ? command.getAliases() : [];
        
        const aliasStr = aliases.length > 0 ? ` (alias: ${aliases.map(a => '/' + a).join(', ')})` : '';
        
        return `  ${Config.colors.green}/${cmdName}${Config.colors.reset}${aliasStr.padEnd(20)} - ${description}`;
      })
      .filter(line => line !== null)
      .join('\n');

    const help = `
${Config.colors.bold}Available Commands:${Config.colors.reset}
  ${Config.colors.green}/help${Config.colors.reset} (alias: /?)        - ${this.description}
${commandList}
`;

    console.log(help);
    return { shouldQuit: false, runApiCall: false };
  }
}