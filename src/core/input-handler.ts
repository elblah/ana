/**
 * Input handler for AI Coder using Node readline
 */

import { Config } from './config.js';
import { DetailMode } from './detail-mode.js';
import { createInterface } from 'node:readline';
import { TempUtils } from './temp-utils.js';
import type { Stats } from './stats.js';
import { PromptHistory } from './prompt-history.js';
import { ContextBar } from './context-bar.js';
import { getSnippetNames } from './snippet-utils.js';
import type { ReadlineInterface, CompletionCallback } from './types.js';
import type { MessageHistory } from './message-history.js';

export class InputHandler {
    private history: string[] = [];
    private historyIndex = -1;
    private rl: ReadlineInterface | null = null;
    private stats: Stats | null = null;
    private promptHistory: PromptHistory;
    private contextBar: ContextBar | null = null;
    private messageHistory: MessageHistory | null = null; // Will be set via setMessageHistory

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
            prompt: '', // No prompt - completely invisible
            completer: (line: string, callback: CompletionCallback) => {
                // Split into words and find the last one starting with @@
                const words = line.split(' ');
                const lastWord = words[words.length - 1];

                if (lastWord.startsWith('@@')) {
                    const names = getSnippetNames();
                    const prefix = lastWord.slice(2).toLowerCase();
                    const hits = names.filter((n) => n.toLowerCase().startsWith(prefix));

                    if (hits.length > 0) {
                        // Replace last word with completion
                        words[words.length - 1] = '@@' + hits[0];
                        const completedLine = words.join(' ');
                        callback(null, [[completedLine], line]);
                    } else {
                        callback(null, [[], line]);
                    }
                } else {
                    callback(null, [[], line]);
                }
            },
        });

        // Set our history on the interface if supported
        if (this.rl.history) {
            this.rl.history = this.history;
        }

        // CRITICAL: Capture SIGINT from persistent readline to prevent bubbling to firejail
        this.rl!.on('SIGINT', () => {
            // Forward to global handler
            process.emit('SIGINT');
        });

        // Handle SIGTSTP in the readline interface to prevent default behavior
        this.rl!.on('SIGTSTP', async () => {
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
    setMessageHistory(messageHistory: MessageHistory): void {
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
            this.rl!.question(
                `${Config.colors.bold}${Config.colors.cyan}> ${Config.colors.reset}`,
                async (line: string) => {
                    // Add to history
                    this.addToHistory(line);
                    // Save to history (skip approval prompts)
                    await this.promptHistory.savePrompt(line);
                    resolve(line);
                }
            );
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
        "Prune Context" "p" "run-shell 'echo p > ${tempFile}'" \\
        "Show Stats" "t" "run-shell 'echo t > ${tempFile}'" \\
        "Save Session" "e" "run-shell 'echo e > ${tempFile}'" \\
        "Quit" "q" "run-shell 'echo q > ${tempFile}'"`;

            // Execute the tmux command to show the menu
            const proc = Bun.spawn(['sh', '-c', tmuxCommand]);
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
                    console.log('error', error);
                }

                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // Clean up the temp file
            try {
                await Bun.$`rm -f ${tempFile}`;
            } catch (error) {
                // Ignore cleanup errors
            }

            // Process the selection
            if (selection) {
                await this.processMenuSelection(selection);
            } else {
                // Timeout occurred
                if (Config.debug) {
                    console.log(`\n${Config.colors.dim}[Menu timeout]${Config.colors.reset}`);
                }
            }
        } catch (error) {
            // If anything goes wrong, clean up and show error
            try {
                await Bun.$`rm -f ${tempFile}`;
            } catch (cleanupError) {
                // Ignore cleanup errors
            }

            console.log(
                `\n${Config.colors.red}[Menu error: ${(error as Error).message}]${Config.colors.reset}`
            );
        }
    }

    /**
     * Process the selected menu option
     */
    private async processMenuSelection(selection: string): Promise<void> {
        switch (selection.toLowerCase()) {
            case 'd':
                this.handleToggleDetail();
                break;

            case 's':
                this.handleStopProcessing();
                break;

            case 'y':
                this.handleToggleYolo();
                break;

            case 'p':
                this.handlePruneContext();
                break;

            case 't':
                this.handleShowStats();
                break;

            case 'e':
                await this.handleSaveSession();
                break;

            case 'q':
                this.handleQuit();
                break;

            default:
                this.handleUnknownSelection();
                break;
        }
    }

    /**
     * Toggle detail mode
     */
    private handleToggleDetail(): void {
        const newState = DetailMode.toggle();
        const status = DetailMode.getStatusText();
        const color = newState ? Config.colors.green : Config.colors.yellow;
        console.log(`\n${color}[*] Detail mode ${status}${Config.colors.reset}`);
    }

    /**
     * Stop processing by emitting SIGINT
     */
    private handleStopProcessing(): void {
        console.log(`\n${Config.colors.yellow}[*] Stopping processing...${Config.colors.reset}`);
        process.emit('SIGINT');
    }

    /**
     * Toggle YOLO mode
     */
    private handleToggleYolo(): void {
        const newYoloState = !Config.yoloMode;
        Config.setYoloMode(newYoloState);
        const yoloStatus = newYoloState ? 'ENABLED' : 'DISABLED';
        const yoloColor = newYoloState ? Config.colors.green : Config.colors.red;
        console.log(`\n${yoloColor}[*] YOLO mode ${yoloStatus}${Config.colors.reset}`);
    }

    /**
     * Prune a percentage of tool call results (only large ones >256 bytes)
     */
    private handlePruneContext(): void {
        if (!this.messageHistory) {
            console.log(
                `\n${Config.colors.cyan}[*] Prune: context not available${Config.colors.reset}`
            );
            return;
        }

        const percentage = Config.tmuxPrunePercentage;
        const result = this.messageHistory.pruneToolResultsByPercentage(percentage);

        if (result.prunedCount === 0 && result.protectedCount === 0) {
            console.log(
                `\n${Config.colors.yellow}[*] No tool results to prune${Config.colors.reset}`
            );
            return;
        }

        if (result.prunedCount === 0) {
            console.log(
                `\n${Config.colors.yellow}[*] All tool results are protected (≤256 bytes)${Config.colors.reset}`
            );
            return;
        }

        console.log(
            `\n${Config.colors.green}[*] Pruned ${result.prunedCount} tool results (${percentage}%), saved ${result.savedBytes.toLocaleString()} bytes${Config.colors.reset}`
        );
        if (result.protectedCount > 0) {
            console.log(
                `\n${Config.colors.dim}    (Protected ${result.protectedCount} tool results ≤ 256 bytes)${Config.colors.reset}`
            );
        }
    }

    /**
     * Show stats immediately
     */
    private handleShowStats(): void {
        if (this.stats) {
            this.stats.printStats();
        } else {
            console.log(
                `\n${Config.colors.cyan}[*] Stats: context not available${Config.colors.reset}`
            );
        }
    }

    /**
     * Save session with timestamp
     */
    private async handleSaveSession(): Promise<void> {
        if (!this.messageHistory) {
            console.log(
                `\n${Config.colors.cyan}[*] Session save: context not available${Config.colors.reset}`
            );
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `session-${timestamp}.json`;
        try {
            const sessionData = this.messageHistory.getMessages();
            await Bun.write(filename, JSON.stringify(sessionData, null, 2));
            console.log(
                `\n${Config.colors.green}[*] Session saved to ${filename}${Config.colors.reset}`
            );
        } catch (error) {
            console.log(
                `\n${Config.colors.red}[*] Error saving session: ${error}${Config.colors.reset}`
            );
        }
    }

    /**
     * Quit the application
     */
    private handleQuit(): void {
        console.log(`\n${Config.colors.yellow}[*] Quitting...${Config.colors.reset}`);
        if (this.stats) {
            this.stats.printStats();
        }
        process.exit(0);
    }

    /**
     * Handle unknown menu selection
     */
    private handleUnknownSelection(): void {
        console.log(`\n${Config.colors.dim}[Unknown selection]${Config.colors.reset}`);
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

            this.history.unshift(command); // Add to beginning for UP arrow navigation
            // Keep history size reasonable
            if (this.history.length > 100) {
                this.history.pop();
            }
            // Update readline history if supported
            if (this.rl!.history) {
                this.rl!.history = this.history;
            }
        }
        this.historyIndex = 0; // Reset to beginning since we added at front
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
        this.rl!.close();
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
                .filter((entry) => !entry.prompt.startsWith('/'))
                .slice(-10)
                .reverse()
                .map((entry) => entry.prompt);
        } catch (error) {
            // Silent fail for history loading
        }
    }

    async prompt(message = ''): Promise<string> {
        if (this.rl!.history) {
            this.rl!.history = []; // Clear readline history only
        }

        return new Promise((resolve) => {
            // Use persistent readline interface with empty history
            this.rl!.question(message, async (answer: string) => {
                if (this.rl!.history) {
                    this.rl!.history = this.history; // Restore readline from class history
                }
                resolve(answer);
            });
        });
    }
}
