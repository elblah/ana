import { BaseCommand, CommandResult } from './base.js';
import { getSnippetNames, loadSnippet, ensureSnippetsDir, SNIPPETS_DIR } from '../snippet-utils.js';
import { Config } from '../config.js';

export class SnippetsCommand extends BaseCommand {
  protected name = 'snippets';
  protected description = 'Manage prompt snippets';

  execute(args: string[]): CommandResult {
    if (args.length === 0) {
      this.showUsage();
      return { shouldQuit: false, runApiCall: false };
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'list':
        return this.listSnippets();
      case 'show':
        return this.showSnippet(args[1]);
      case 'path':
        return this.showPath();
      default:
        console.log(`${Config.colors.red}[!] Unknown subcommand: ${subcommand}${Config.colors.reset}`);
        this.showUsage();
        return { shouldQuit: false, runApiCall: false };
    }
  }

  private showUsage(): void {
    console.log(`${Config.colors.cyan}Usage: /snippets <command>${Config.colors.reset}`);
    console.log(`${Config.colors.cyan}Commands:${Config.colors.reset}`);
    console.log(`  ${Config.colors.green}list${Config.colors.reset}    - List all available snippets`);
    console.log(`  ${Config.colors.green}show${Config.colors.reset}    <name> - Show snippet content`);
    console.log(`  ${Config.colors.green}path${Config.colors.reset}    - Show snippets directory path`);
  }

  private listSnippets(): CommandResult {
    const names = getSnippetNames();
    
    if (names.length === 0) {
      console.log(`${Config.colors.yellow}[!] No snippets found${Config.colors.reset}`);
      console.log(`${Config.colors.dim}Create .txt files in ~/.config/aicoder-mini/snippets/${Config.colors.reset}`);
    } else {
      console.log(`${Config.colors.cyan}Available snippets:${Config.colors.reset}`);
      names.forEach(name => {
        console.log(`  ${Config.colors.green}${name}${Config.colors.reset}`);
      });
    }
    
    return { shouldQuit: false, runApiCall: false };
  }

  private showSnippet(name: string): CommandResult {
    if (!name) {
      console.log(`${Config.colors.red}[!] Missing snippet name${Config.colors.reset}`);
      console.log(`${Config.colors.cyan}Usage: /snippets show <name>${Config.colors.reset}`);
      return { shouldQuit: false, runApiCall: false };
    }

    const content = loadSnippet(name);
    if (content !== null) {
      console.log(`${Config.colors.cyan}Snippet '@${name}':${Config.colors.reset}`);
      console.log(`${Config.colors.dim}${content}${Config.colors.reset}`);
    } else {
      console.log(`${Config.colors.red}[!] Snippet '${name}' not found${Config.colors.reset}`);
    }
    
    return { shouldQuit: false, runApiCall: false };
  }

  private showPath(): CommandResult {
    ensureSnippetsDir();
    console.log(`${Config.colors.cyan}Snippets directory:${Config.colors.reset}`);
    console.log(`  ${Config.colors.green}${SNIPPETS_DIR}${Config.colors.reset}`);
    return { shouldQuit: false, runApiCall: false };
  }
}