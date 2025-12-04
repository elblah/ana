/**
 * Input handler for AI Coder using Node readline
 */

import { Config } from './config.js';
import { LogUtils } from '../utils/log-utils.js';
import { createInterface } from 'node:readline';
import { TempFileUtils } from '../utils/temp-file-utils.js';
import type { Stats } from './stats.js';
import { PromptHistory } from './prompt-history.js';
import { ContextBar } from './context-bar.js';
import { getSnippetNames } from './snippet-utils.js';
import type { ReadlineInterface, CompletionCallback } from './types/index.js';
import type { MessageHistory } from './message-history.js';
import { DateTimeUtils } from '../utils/datetime-utils.js';
import { JsonUtils } from '../utils/json-utils.js';
import { ShellUtils } from '../utils/shell-utils.js';
import { FileUtils } from '../utils/file-utils.js';
import { pluginSystem } from './plugin-system.js';
import type { PopupMenuItem } from './types/index.js';



export class InputHandler {
    private history: string[] = [];
    private historyIndex = -1;
    private rl: ReadlineInterface | null = null;
    private stats: Stats | null = null;
    private promptHistory: PromptHistory;
    private contextBar: ContextBar | null = null;
    private messageHistory: MessageHistory | null = null; // Will be set via setMessageHistory
    private pluginSystem = pluginSystem;

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

        // Forward SIGINT to global handler
        this.rl!.on('SIGINT', () => {
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
                // Not in tmux: just tell them about tmux features
                LogUtils.print('\n[*] Use tmux for enhanced features (Ctrl+Z menu, detail mode toggle, etc.)', {
                    color: Config.colors.cyan,
                });
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
    async getUserInput(): Promise<string> {
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
        const tempFile = TempFileUtils.createTempFile('aicoder-menu', '.txt');

        try {
            // Build base menu items
            const baseItems: PopupMenuItem[] = [
                {
                    label: `Toggle Detail (${Config.detailMode ? 'ON' : 'OFF'})`,
                    key: 'd',
                    handler: () => this.handleToggleDetail(),
                },
                {
                    label: 'Stop Processing',
                    key: 's',
                    handler: () => this.handleStopProcessing(),
                },
                {
                    label: `Toggle YOLO (${Config.yoloMode ? 'ON' : 'OFF'})`,
                    key: 'y',
                    handler: () => this.handleToggleYolo(),
                },
                {
                    label: `Toggle FS Sandbox (${Config.sandboxDisabled ? 'OFF' : 'ON'})`,
                    key: 'f',
                    handler: () => this.handleToggleFsSandbox(),
                },
                {
                    label: 'Prune Context',
                    key: 'p',
                    handler: () => this.handlePruneContext(),
                },
                {
                    label: 'Show Stats',
                    key: 't',
                    handler: () => this.handleShowStats(),
                },
                {
                    label: 'Save Session',
                    key: 'e',
                    handler: async () => await this.handleSaveSession(),
                },
                {
                    label: 'Quit',
                    key: 'q',
                    handler: () => this.handleQuit(),
                },
            ];

            // Get plugin menu items
            const pluginItems = Array.from(this.pluginSystem.getPopupMenuItems().values());

            // Combine all items
            const allItems = [...baseItems, ...pluginItems];

            // Build tmux display-menu command
            const menuItems = allItems.map(item => 
                `"${item.label}" "${item.key}" "run-shell 'echo ${item.key} > ${tempFile}'"`
            ).join(' \\\n        ');

            const tmuxCommand = `tmux display-menu -t . -T "AI Coder Menu" \\\n        ${menuItems}`;

            // Execute the tmux command to show the menu
            const result = await ShellUtils.executeCommand(tmuxCommand);

            // Wait for the temp file to be created and read the selection
            let selection = '';
            const maxWaitTime = 3000; // 3 seconds timeout
            const startTime = Date.now();

            while (Date.now() - startTime < maxWaitTime) {
                try {
                    // Check if file exists and has content
                    const content = await FileUtils.readFile(tempFile);
                    if (content) {
                        selection = content;
                        selection = selection.trim();
                        if (selection) {
                            break;
                        }
                    }
                } catch (error) {
                    // File might not exist yet, continue waiting
                    LogUtils.debug(`Temp menu file not ready: ${(error as Error).message}`);
                }

                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // Clean up the temp file
            TempFileUtils.deleteFile(tempFile);

            // Process the selection
            if (selection) {
                await this.processMenuSelection(selection);
            } else {
                // Timeout occurred
                LogUtils.debug(`\n[Menu timeout]`, Config.colors.dim);
            }
        } catch (error) {
            // If anything goes wrong, clean up and show error
            TempFileUtils.deleteFile(tempFile);

            LogUtils.error(`\n[Menu error: ${(error as Error).message}]`);
        }
    }



    /**
     * Process the selected menu option
     */
    private async processMenuSelection(selection: string): Promise<void> {
        const selectionKey = selection.toLowerCase();
        let handled = false;

        // Check base menu items first
        switch (selectionKey) {
            case 'd':
                this.handleToggleDetail();
                handled = true;
                break;

            case 's':
                this.handleStopProcessing();
                handled = true;
                break;

            case 'y':
                this.handleToggleYolo();
                handled = true;
                break;

            case 'f':
                this.handleToggleFsSandbox();
                handled = true;
                break;

            case 'p':
                this.handlePruneContext();
                handled = true;
                break;

            case 't':
                this.handleShowStats();
                handled = true;
                break;

            case 'e':
                await this.handleSaveSession();
                handled = true;
                break;

            case 'q':
                this.handleQuit();
                handled = true;
                break;
        }

        // If not handled by base items, check plugin items
        if (!handled) {
            const pluginItems = this.pluginSystem.getPopupMenuItems();
            const pluginItem = pluginItems.get(selectionKey);
            
            if (pluginItem) {
                try {
                    await pluginItem.handler();
                } catch (error) {
                    LogUtils.error(`[Menu plugin error: ${(error as Error).message}]`);
                }
            } else {
                this.handleUnknownSelection();
            }
        }
    }

    /**
     * Toggle detail mode
     */
    private handleToggleDetail(): void {
        Config.detailMode = !Config.detailMode;
        const status = Config.detailMode ? 'ENABLED' : 'DISABLED';
        const color = Config.detailMode ? Config.colors.green : Config.colors.yellow;
        LogUtils.print(`\n[*] Detail mode ${status}`, { color });
    }

    /**
     * Stop processing by emitting SIGINT
     */
    private handleStopProcessing(): void {
        LogUtils.warn('\n[*] Stopping processing...');
        process.emit('SIGINT');
    }

    /**
     * Toggle YOLO mode
     */
    private handleToggleYolo(): void {
        const newYoloState = !Config.yoloMode;
        Config.setYoloMode(newYoloState);
        const yoloStatus = newYoloState ? 'ENABLED' : 'DISABLED';
        LogUtils.print(`\n[*] YOLO mode ${yoloStatus}`, {
            color: newYoloState ? Config.colors.green : Config.colors.red,
        });
    }

    /**
     * Toggle filesystem sandbox
     */
    private handleToggleFsSandbox(): void {
        const currentState = Config.sandboxDisabled;
        const newState = !currentState;
        Config.setSandboxDisabled(newState);
        const status = newState ? 'DISABLED' : 'ENABLED';
        LogUtils.print(`\n[*] FS sandbox ${status}`, {
            color: !newState ? Config.colors.green : Config.colors.red,
        });
    }



    /**
     * Prune a percentage of tool call results (only large ones >256 bytes)
     */
    private handlePruneContext(): void {
        if (!this.messageHistory) {
            LogUtils.print(`\n[*] Prune: context not available`, { color: Config.colors.cyan });
            return;
        }

        const percentage = Config.tmuxPrunePercentage;
        const result = this.messageHistory.pruneToolResultsByPercentage(percentage);

        if (result.prunedCount === 0 && result.protectedCount === 0) {
            LogUtils.warn(`\n[*] No tool results to prune`);
            return;
        }

        if (result.prunedCount === 0) {
            LogUtils.warn(`\n[*] All tool results are protected (≤256 bytes)`);
            return;
        }

        LogUtils.success(
            `\n[*] Pruned ${result.prunedCount} tool results (${percentage}%), saved ${result.savedBytes.toLocaleString()} bytes`
        );
        if (result.protectedCount > 0) {
            LogUtils.print(`\n    (Protected ${result.protectedCount} tool results ≤ 256 bytes)`, {
                color: Config.colors.dim,
            });
        }
    }

    /**
     * Show stats immediately
     */
    private handleShowStats(): void {
        if (this.stats) {
            this.stats.printStats();
        } else {
            LogUtils.print(`\n[*] Stats: context not available`, { color: Config.colors.cyan });
        }
    }

    /**
     * Save session with timestamp
     */
    private async handleSaveSession(): Promise<void> {
        if (!this.messageHistory) {
            LogUtils.print(`\n[*] Session save: context not available`, {
                color: Config.colors.cyan,
            });
            return;
        }

        const filename = DateTimeUtils.createTimestampFilename('session', '.json');
        try {
            const sessionData = this.messageHistory.getMessages();
            await JsonUtils.writeFile(filename, sessionData as unknown);
            LogUtils.success(`\n[*] Session saved to ${filename}`);
        } catch (error) {
            LogUtils.error(`\n[*] Error saving session: ${error}`);
        }
    }

    /**
     * Quit the application
     */
    private handleQuit(): void {
        LogUtils.warn(`\n[*] Quitting...`);
        if (this.stats) {
            this.stats.printStats();
        }
        process.exit(0);
    }

    /**
     * Handle unknown menu selection
     */
    private handleUnknownSelection(): void {
        LogUtils.print(`\n[Unknown selection]`, { color: Config.colors.dim });
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
