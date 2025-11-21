import { BaseCommand, CommandResult } from './base.js';
import { Config } from '../config.js';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { exec } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { TempUtils } from '../temp-utils.js';
import { PromptHistory } from '../prompt-history.js';

const colors = Config.colors;

export class EditCommand extends BaseCommand {
  protected name = 'edit';
  protected description = 'Create new message in $EDITOR';
  private promptHistory: PromptHistory;

  constructor() {
    super();
    this.promptHistory = new PromptHistory();
  }

  getAliases(): string[] {
    return ['e'];
  }

  async execute(): Promise<CommandResult> {
    if (!process.env.TMUX) {
      console.log(colors.red + 'This command only works inside a tmux environment.' + colors.reset);
      console.log(colors.yellow + 'Please run this command inside tmux.' + colors.reset);
      return { shouldQuit: false, runApiCall: false };
    }

    const editor = process.env.EDITOR || 'nano';
    const randomSuffix = randomBytes(4).toString('hex');
    const tempFile = TempUtils.createTempFile(`aicoder-edit-${randomSuffix}`, '.md');

    try {
      writeFileSync(tempFile, '', 'utf8');
      console.log(colors.cyan + 'Opening ' + editor + ' in tmux window...' + colors.reset);
      console.log(colors.dim + 'Save and exit when done. The editor is running in a separate tmux window.' + colors.reset);

      const syncPoint = `edit_done_${randomSuffix}`;
      const windowName = `edit_${randomSuffix}`;
      
      const tmuxCmd = `tmux new-window -n "${windowName}" 'bash -c "${editor} ${tempFile}; tmux wait-for -S ${syncPoint}"'`;
      
      await new Promise<void>((resolve, reject) => {
        exec(tmuxCmd, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await new Promise<void>((resolve, reject) => {
        exec(`tmux wait-for ${syncPoint}`, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      const content = readFileSync(tempFile, 'utf8').trim();

      if (content) {
        // Save editor content to history
        await this.promptHistory.savePrompt(content);
        
        console.log(colors.green + 'Message composed.' + colors.reset);
        console.log(colors.dim + '--- Message ---' + colors.reset);
        console.log(content);
        console.log(colors.dim + '---------------' + colors.reset);
        return { shouldQuit: false, runApiCall: true, message: content };
      }

      console.log(colors.yellow + 'Empty message - cancelled.' + colors.reset);

    } catch (error) {
      console.log(colors.red + 'Error with editor: ' + error + colors.reset);
    } finally {
      if (existsSync(tempFile)) {
        unlinkSync(tempFile);
      }
    }

    return { shouldQuit: false, runApiCall: false };
  }
}