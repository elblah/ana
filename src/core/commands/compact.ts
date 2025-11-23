import { BaseCommand, type CommandResult } from './base.js';
import { Config } from '../config.js';
import { PRUNED_TOOL_MESSAGE } from '../message-history.js';

interface CompactArgs {
    force?: boolean;
    forceMessages?: boolean;
    prune?: string;
    count?: number;
}

export class CompactCommand extends BaseCommand {
    protected name = 'compact';
    protected description = 'Compact conversation history';
    protected usage = '/compact [force <N> | force-messages <N> | prune [all|stats|<N>]]';

    async execute(args: string[] = []): Promise<CommandResult> {
        const parsed = this.parseArgs(args);

        await this.handleCompact(parsed);

        return {
            shouldQuit: false,
            runApiCall: false,
        };
    }

    private parseArgs(args: string[]): CompactArgs {
        const parsed: CompactArgs = {};

        if (args.length === 0) {
            return parsed; // Normal auto-compact
        }

        const command = args[0].toLowerCase();

        if (command === 'force' && args.length > 1) {
            parsed.force = true;
            parsed.count = Number.parseInt(args[1]) || 1;
        } else if (command === 'force-messages' && args.length > 1) {
            parsed.forceMessages = true;
            parsed.count = Number.parseInt(args[1]) || 1;
        } else if (command === 'prune') {
            parsed.prune = args.length > 1 ? args[1].toLowerCase() : 'all';
            if (parsed.prune !== 'all' && parsed.prune !== 'stats') {
                parsed.count = Number.parseInt(parsed.prune);
                if (isNaN(parsed.count) || parsed.count < 1) {
                    console.log(
                        `${Config.colors.red}[X] Invalid prune count: ${parsed.prune}${Config.colors.reset}`
                    );
                    console.log(
                        `${Config.colors.yellow}[i] Usage: ${this.usage}${Config.colors.reset}`
                    );
                    return {} as CompactArgs;
                }
            }
            return this.handlePrune(parsed);
        } else if (command === 'stats') {
            // Handle stats
            return this.showStats();
        } else if (command === 'help') {
            this.showHelp();
        } else {
            console.log(
                `${Config.colors.red}[X] Unknown compact command: ${command}${Config.colors.reset}`
            );
            console.log(`${Config.colors.yellow}[i] Usage: ${this.usage}${Config.colors.reset}`);
        }

        return parsed;
    }

    private async handleCompact(args: CompactArgs): Promise<void> {
        const messageHistory = this.context.messageHistory;
        messageHistory.estimateContext(); // Update token estimate
        const currentTokens = this.context.stats.currentPromptSize || 0;
        const threshold = Config.autoCompactThreshold;
        const rounds = messageHistory.getRoundCount();

        if (args.force) {
            await messageHistory.forceCompactRounds(args.count!);
            return;
        }

        if (args.forceMessages) {
            await messageHistory.forceCompactMessages(args.count!);
            return;
        }

        // Normal auto-compaction
        if (!Config.autoCompactEnabled) {
            console.log(
                `${Config.colors.yellow}[i] Auto-compaction is disabled${Config.colors.reset}`
            );
            return;
        }

        if (rounds === 0) {
            console.log(
                `${Config.colors.yellow}[i] No messages available to compact${Config.colors.reset}`
            );
            return;
        }

        const percentage = threshold > 0 ? (currentTokens / threshold) * 100 : 0;
        if (percentage < 80) {
            console.log(
                `${Config.colors.yellow}[i] Auto-compaction not needed (${percentage.toFixed(1)}% of ${threshold.toLocaleString()} tokens)${Config.colors.reset}`
            );
            console.log(
                `${Config.colors.yellow}[i] Current conversation: ${rounds} rounds (user + assistant exchanges)${Config.colors.reset}`
            );
            return;
        }

        try {
            await messageHistory.compactMemory();
        } catch (error) {
            console.log(
                `${Config.colors.red}[X] Compaction failed: ${error}${Config.colors.reset}`
            );
        }
    }

    private showStats(): CompactArgs {
        const messageHistory = this.context.messageHistory;
        messageHistory.estimateContext(); // Update token estimate
        const currentTokens = this.context.stats.currentPromptSize || 0;
        const threshold = Config.autoCompactThreshold;
        const rounds = messageHistory.getRoundCount();
        const percentage = threshold > 0 ? (currentTokens / threshold) * 100 : 0;

        console.log(`${Config.colors.cyan}Conversation Statistics:${Config.colors.reset}`);
        console.log(`  Rounds (user+assistant): ${rounds}`);
        console.log(`  Messages (total): ${messageHistory.getMessageCount()}`);
        console.log(
            `  Token usage: ${currentTokens.toLocaleString()} / ${threshold.toLocaleString()} (${percentage.toFixed(1)}%)`
        );
        console.log(`  Auto-compaction: ${Config.autoCompactEnabled ? 'enabled' : 'disabled'}`);
        console.log(`  Total compactions: ${messageHistory.getCompactionCount()}`);

        return {} as CompactArgs; // Return to satisfy type
    }

    /**
     * Handle prune operations
     */
    private handlePrune(args: CompactArgs): CompactArgs {
        const messageHistory = this.context.messageHistory;
        const stats = messageHistory.getToolCallStats();

        if (args.prune === 'stats') {
            console.log(`${Config.colors.cyan}Tool Call Statistics:${Config.colors.reset}`);
            console.log(`  Tool results: ${stats.count}`);
            console.log(`  Estimated tokens: ${stats.tokens.toLocaleString()}`);
            console.log(`  Total bytes: ${stats.bytes.toLocaleString()}`);

            if (stats.count > 0) {
                const avgBytes = Math.round(stats.bytes / stats.count);
                const avgTokens = Math.round(stats.tokens / stats.count);
                console.log(`  Average per result: ${avgBytes} bytes, ${avgTokens} tokens`);
            }

            return {} as CompactArgs;
        }

        const pruneAll = args.prune === 'all';
        const pruneCount = pruneAll ? 0 : args.count || 1;

        if (stats.count === 0) {
            console.log(
                `${Config.colors.yellow}[i] No tool results to prune${Config.colors.reset}`
            );
            return {} as CompactArgs;
        }

        if (pruneAll) {
            const prunedCount = messageHistory.pruneAllToolResults();
            console.log(
                `${Config.colors.green}[✓] Pruned ${prunedCount} tool result(s)${Config.colors.reset}`
            );
        } else {
            const toPrune = Math.min(pruneCount, stats.count);
            const prunedCount = messageHistory.pruneOldestToolResults(toPrune);
            console.log(
                `${Config.colors.green}[✓] Pruned ${prunedCount} oldest tool result(s)${Config.colors.reset}`
            );
        }

        return {} as CompactArgs;
    }

    private showHelp(): CompactArgs {
        console.log(`${Config.colors.cyan}Compact Command Help:${Config.colors.reset}`);
        console.log(`  ${this.usage}`);
        console.log(``);
        console.log(`  Commands:`);
        console.log(`    /compact                    Try auto-compaction`);
        console.log(`    /compact force <N>           Force compact N oldest rounds`);
        console.log(`    /compact force-messages <N>   Force compact N oldest individual messages`);
        console.log(`    /compact prune all           Prune all tool call results`);
        console.log(`    /compact prune stats         Show tool call statistics`);
        console.log(`    /compact prune <N>           Prune N oldest tool call results`);
        console.log(`    /compact stats               Show conversation statistics`);
        console.log(`    /compact help                Show this help`);
        console.log(``);
        console.log(`  Examples:`);
        console.log(`    /compact force 3            Compact 3 oldest rounds`);
        console.log(`    /compact force-messages 15   Compact 15 oldest messages`);
        console.log(`    /compact prune all           Clear all tool results`);
        console.log(`    /compact prune 5             Clear 5 oldest tool results`);
        console.log(`    /compact prune stats         Show tool call stats`);
        console.log(``);
        console.log(`  Definitions:`);
        console.log(`    Round = User + Assistant response (with tool calls)`);
        console.log(`    Message = Individual message (user, assistant, or tool)`);
        console.log(`    Prune = Replace tool result content with "${PRUNED_TOOL_MESSAGE}"`);

        return {} as CompactArgs; // Return to satisfy type
    }
}
