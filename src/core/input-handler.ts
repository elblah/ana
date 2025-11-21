/**
 * Input handler for AI Coder using Node readline
 */

import { Config } from './config.js';
import { DetailMode } from './detail-mode.js';
import { createInterface } from 'node:readline';
import { TempUtils } from './temp-utils.js';
import { Stats } from './stats.js';
import { PromptHistory } from './prompt-history.js';
import { ContextBar } from './context-bar.js';

export class InputHandler {
  private history: string[] = [];
  private historyIndex: number = -1;
  private rl: any;
  private stats: Stats | null = null;
  private promptHistory: PromptHistory;
  private contextBar: ContextBar | null = null;
  private messageHistory: any = null; // Will be set via setMessageHistory

  constructor() {
    this.promptHistory = new PromptHistory();
    
    // Load history BEFORE creating readline interface
    this.loadPromptHistorySync();
    
    // Create PERSISTENT invisible readline interface to prevent signal bubbling to firejail
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      history: this.history,
      historySize: 100,
      prompt: '' // No prompt - completely invisible
    });

    // CRITICAL: Capture SIGINT from persistent readline to prevent bubbling to firejail
    this.rl.on('SIGINT', () => {
      // Forward to global handler
      process.emit('SIGINT' as any);
    });

    // Handle SIGTSTP in the readline interface to prevent default behavior
    this.rl.on('SIGTSTP', async () => {
      // Check if we're in tmux
      const inTmux = !!process.env.TMUX_PANE;
      
      if (inTmux) {
        // In tmux: show the menu and don't suspend
        await this.showTmuxPopupMenu();
      } else {
        // Not in tmux: toggle detail mode and don't suspend
        const newState = DetailMode.toggle();
        const status = DetailMode.getStatusText();
        const color = newState ? Config.colors.green : Config.colors.yellow;

        console.log(`\n${color}[*] Detail mode ${status}${Config.colors.reset}`);
        console.log(`${Config.colors.bold}${Config.colors.cyan}> ${Config.colors.reset}`, '');
      }
      // By handling the event in the readline interface, we prevent the default suspend behavior
    });
  }

  /**
   * Set the stats context for the input handler
   */
  setStatsContext(stats: Stats): void {
    this.stats = stats;
  }

  /**
   * Set the message history and context bar
   */
  setMessageHistory(messageHistory: any): void {
    this.messageHistory = messageHistory;
    this.contextBar = new ContextBar();
  }

  /**
   * Get input from user - single line
   */
  async getMultilineInput(): Promise<string> {
    return new Promise((resolve) => {
      // Show context bar before user prompt (if available)
      if (this.contextBar && this.stats && this.messageHistory) {
        this.contextBar.printContextBarForUser(this.stats, this.messageHistory);
      }

      // Use the persistent readline interface instead of creating new one
      this.rl.question(`${Config.colors.bold}${Config.colors.cyan}> ${Config.colors.reset}`, async (line: string) => {
        // Add to history
        this.addToHistory(line);
        // Save to history (skip approval prompts)
        await this.promptHistory.savePrompt(line);
        resolve(line);
      });
    });
  }

  /**
   * Show popup menu using tmux display-menu
   */
  private async showTmuxPopupMenu(): Promise<void> {
    // Create a temporary file for IPC
    const tempFile = TempUtils.createTempFile('aicoder-menu', '.txt');
    
    try {
      // Build the tmux display-menu command
      const tmuxCommand = `tmux display-menu -t . -T "AI Coder Menu" \\
        "Toggle Detail" "d" "run-shell 'echo d > ${tempFile}'" \\
        "Stop Processing" "s" "run-shell 'echo s > ${tempFile}'" \\
        "Toggle YOLO" "y" "run-shell 'echo y > ${tempFile}'" \\
        "Show Stats" "t" "run-shell 'echo t > ${tempFile}'" \\
        "Quit" "q" "run-shell 'echo q > ${tempFile}'"`;
      
      // Execute the tmux command to show the menu
      const proc = Bun.spawn(["sh", "-c", tmuxCommand]);
      await proc.exited;
      
      // Wait for the temp file to be created and read the selection
      let selection = '';
      const maxWaitTime = 3000; // 3 seconds timeout
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        try {
          // Check if file exists and has content
          const fileExists = await Bun.file(tempFile).exists();
          if (fileExists) {
            selection = await Bun.file(tempFile).text();
            selection = selection.trim();
            if (selection) {
              break;
            }
          }
        } catch (error) {
          // File might not exist yet, continue waiting
          console.log("error", error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Clean up the temp file
      try {
        await Bun.$`rm -f ${tempFile}`;
      } catch (error) {
        // Ignore cleanup errors
      }
      
      // Process the selection
      if (selection) {
        this.processMenuSelection(selection);
      } else {
        // Timeout occurred
        if (Config.debug) {
          console.log(`\n${Config.colors.dim}[Menu timeout]${Config.colors.reset}`);
        }
        console.log(`${Config.colors.bold}${Config.colors.cyan}> ${Config.colors.reset}`, '');
      }
      
    } catch (error) {
      // If anything goes wrong, clean up and show error
      try {
        await Bun.$`rm -f ${tempFile}`;
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      console.log(`\n${Config.colors.red}[Menu error: ${(error as Error).message}]${Config.colors.reset}`);
      console.log(`${Config.colors.bold}${Config.colors.cyan}> ${Config.colors.reset}`, '');
    }
  }

  /**
   * Process the selected menu option
   */
  private processMenuSelection(selection: string): void {
    switch (selection.toLowerCase()) {
      case 'd':
        const newState = DetailMode.toggle();
        const status = DetailMode.getStatusText();
        const color = newState ? Config.colors.green : Config.colors.yellow;
        console.log(`\n${color}[*] Detail mode ${status}${Config.colors.reset}`);
        break;
        
      case 's':
        console.log(`\n${Config.colors.yellow}[*] Stopping processing...${Config.colors.reset}`);
        // Emit SIGINT to stop processing
        process.emit('SIGINT');
        break;
        
      case 'y':
        const newYoloState = !Config.yoloMode;
        Config.setYoloMode(newYoloState);
        const yoloStatus = newYoloState ? 'ENABLED' : 'DISABLED';
        const yoloColor = newYoloState ? Config.colors.green : Config.colors.red;
        console.log(`\n${yoloColor}[*] YOLO mode ${yoloStatus}${Config.colors.reset}`);
        break;
        
      case 't':
        // Print stats immediately
        if (this.stats) {
          this.stats.printStats();
        } else {
          console.log(`\n${Config.colors.cyan}[*] Stats: context not available${Config.colors.reset}`);
        }
        break;
        
      case 'q':
        console.log(`\n${Config.colors.yellow}[*] Quitting...${Config.colors.reset}`);
        // Print stats before quitting
        if (this.stats) {
          this.stats.printStats();
        }
        // Exit immediately
        process.exit(0);
        break;
        
      default:
        console.log(`\n${Config.colors.dim}[Unknown selection]${Config.colors.reset}`);
        break;
    }
    
    // Show the prompt again
    console.log(`${Config.colors.bold}${Config.colors.cyan}> ${Config.colors.reset}`, '');
  }

  /**
   * Add command to history
   */
  addToHistory(command: string): void {
    if (command.trim()) {
      // Remove any existing occurrence to avoid duplicates
      const index = this.history.indexOf(command);
      if (index > -1) {
        this.history.splice(index, 1);
      }
      
      this.history.unshift(command);  // Add to beginning for UP arrow navigation
      // Keep history size reasonable
      if (this.history.length > 100) {
        this.history.pop();
      }
      // Update readline history
      this.rl.history = this.history;
    }
    this.historyIndex = 0;  // Reset to beginning since we added at front
  }

  /**
   * Get history
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * Close the persistent readline interface - needed for clean exit
   */
  close(): void {
    this.rl.close();
  }

  /**
   * Simple prompt for single line input
   */
  /**
   * Load existing prompts into readline history (synchronous for constructor)
   */
  private loadPromptHistorySync(): void {
    try {
      const entries = this.promptHistory.readHistorySync();
      // Only add prompts (not commands starting with /) to readline history
      // Take only last 10 and reverse (newest first for readline)
      this.history = entries
        .filter(entry => !entry.prompt.startsWith('/'))
        .slice(-10)
        .reverse()
        .map(entry => entry.prompt);
    } catch (error) {
      // Silent fail for history loading
    }
  }



  async prompt(message: string = ''): Promise<string> {
    this.rl.history = []; // Clear readline history only
    
    return new Promise((resolve) => {
      // Use persistent readline interface with empty history
      this.rl.question(message, async (answer: string) => {
        this.rl.history = this.history; // Restore readline from class history
        resolve(answer);
      });
    });
  }
}
