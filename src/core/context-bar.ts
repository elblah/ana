/**
 * Context bar component for displaying context usage
 */

import { Config } from './config.js';
import { Stats } from './stats.js';
import { MessageHistory } from './message-history.js';

export class ContextBar {
  constructor() {
  }

  /**
   * Format the context bar with colored progress bar
   */
  formatContextBar(stats: Stats, messageHistory: MessageHistory): string {
    // Context size is automatically updated when messages are added
    const currentTokens = stats.currentPromptSize || 0;
    const maxTokens = Config.contextSize;
    
    // Guard against invalid values that could cause Infinity or NaN
    let percentage = 0;
    if (maxTokens > 0 && isFinite(currentTokens) && isFinite(maxTokens)) {
      percentage = (currentTokens / maxTokens) * 100;
      // Cap at reasonable values to prevent display issues
      if (percentage > 999) percentage = 999;
    }
    
    const percentageStr = isFinite(percentage) ? percentage.toFixed(0) : '0';

    // Format progress bar
    const progressBar = this.createProgressBar(percentage);

    // Format current tokens (in k if large)
    const currentTokensStr = currentTokens > 1000
      ? `${(currentTokens / 1000).toFixed(1)}k`
      : currentTokens.toString();

    const maxTokensStr = maxTokens > 1000
      ? `${(maxTokens / 1000).toFixed(1)}k`
      : maxTokens.toString();



    // Get model name (from environment or default)
    const model = Config.model || 'unknown';
    const modelShort = model.split('/').pop() || model; // Take last part of model path

    // Build the base context bar (not dimmed)
    const contextBar = `Context: ${progressBar} ${percentageStr}% (${currentTokensStr}/${maxTokensStr} @${modelShort})`;

    // Add time at the end if provided (dimmed)
    const timeStr = this.getCurrentHour();
    if (timeStr) {
      return `${contextBar}${Config.colors.dim} - ${timeStr}${Config.colors.reset}`;
    }

    return `${contextBar}${Config.colors.reset}`;
  }

  /**
   * Get current hour string
   */
  private getCurrentHour(): string {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  }

  /**
   * Create a colored progress bar based on percentage
   */
  private createProgressBar(percentage: number): string {
    const barWidth = 10;
    
    // Guard against invalid percentage values (Infinity, NaN, negative)
    const safePercentage = Math.max(0, Math.min(100, percentage || 0));
    
    const filledChars = Math.round((safePercentage / 100) * barWidth);
    const emptyChars = Math.max(0, barWidth - filledChars);

    // Choose color based on percentage
    let color: string;
    if (safePercentage <= 30) {
      color = Config.colors.green;
    } else if (safePercentage <= 80) {
      color = Config.colors.yellow;
    } else {
      color = Config.colors.red;
    }

    // Guard against negative values for repeat
    const safeFilledChars = Math.max(0, filledChars);
    const safeEmptyChars = Math.max(0, emptyChars);

    const filledBar = '█'.repeat(safeFilledChars);
    const emptyBar = '░'.repeat(safeEmptyChars);

    return `${color}${filledBar}${Config.colors.dim}${emptyBar}${Config.colors.reset}`;
  }





  /**
   * Print context bar (for AI prompt)
   */
  printContextBar(stats: Stats, messageHistory: MessageHistory): void {
    const contextBar = this.formatContextBar(stats, messageHistory);
    console.log(contextBar);
  }

  /**
   * Print context bar for user prompt (with newline before)
   */
  printContextBarForUser(stats: Stats, messageHistory: MessageHistory): void {
    const contextBar = this.formatContextBar(stats, messageHistory);
    console.log(`\n${contextBar}`);
  }
}