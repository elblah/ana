/**
 * Centralized tool output formatter
 */

import { DetailMode } from './detail-mode.js';
import { Config } from './config.js';

export interface ToolOutput {
    tool: string;
    friendly?: string; // Human-friendly message when detail mode is OFF
    important?: {
        // Structured data when detail mode is ON
        [key: string]: unknown;
    };
    detailed?: {
        [key: string]: unknown;
    };
    results?: {
        [key: string]: unknown;
        showWhenDetailOff?: boolean;
    };
    approvalShown?: boolean; // Flag to indicate approval details were already displayed
}

export interface ToolPreview {
    tool: string;
    summary: string; // Brief description of the change
    content: string; // The preview content (whatever the tool generates)
    warning?: string; // Any warnings about the operation
    canApprove: boolean; // Whether this operation can be auto-approved
    isDiff?: boolean; // Whether the content is a diff that needs coloring
}

export class ToolFormatter {
    /**
     * Colorize diff output
     */
    static colorizeDiff(diffOutput: string): string {
        const lines = diffOutput.split('\n');
        const coloredLines: string[] = [];

        for (const line of lines) {
            // Skip diff header lines (--- and +++)
            if (line.startsWith('---') || line.startsWith('+++')) {
                continue;
            }

            if (line.startsWith('-')) {
                coloredLines.push(`${Config.colors.red}${line}${Config.colors.reset}`);
            } else if (line.startsWith('+')) {
                coloredLines.push(`${Config.colors.green}${line}${Config.colors.reset}`);
            } else if (line.startsWith('@@')) {
                coloredLines.push(`${Config.colors.cyan}${line}${Config.colors.reset}`);
            } else {
                coloredLines.push(line);
            }
        }

        return coloredLines.join('\n');
    }

    /**
     * Format preview for display
     */
    static formatPreview(preview: ToolPreview): string {
        const lines: string[] = [];

        lines.push(`${Config.colors.cyan}[PREVIEW] ${preview.summary}${Config.colors.reset}`);

        if (preview.warning) {
            lines.push(
                `${Config.colors.yellow}[!] Warning: ${preview.warning}${Config.colors.reset}`
            );
        }

        lines.push('');

        // Colorize diff content if explicitly marked as diff
        if (preview.isDiff) {
            lines.push(this.colorizeDiff(preview.content));
        } else {
            lines.push(preview.content);
        }

        return lines.join('\n');
    }

    /**
     * Format tool output for AI consumption
     * Always returns the full formatted output regardless of detail mode
     */
    static formatForAI(output: ToolOutput): string {
        const lines: string[] = [];
        const indent = '  '; // 2 spaces for cleaner alignment

        // Always show important info (full output for AI)
        if (output.important) {
            for (const [key, value] of Object.entries(output.important)) {
                const label = this.formatLabel(key);
                lines.push(`${indent}${label}${this.formatValueForAI(value)}`);
            }
        }

        // Always show detailed info (full output for AI)
        if (output.detailed) {
            for (const [key, value] of Object.entries(output.detailed)) {
                const label = this.formatLabel(key);
                lines.push(`${indent}${label}${this.formatValueForAI(value)}`);
            }
        }

        // Always show results (except for showWhenDetailOff flag which is for display purposes)
        if (output.results) {
            for (const [key, value] of Object.entries(output.results)) {
                if (key !== 'showWhenDetailOff') {
                    const label = this.formatLabel(key);
                    lines.push(`${indent}${label}${this.formatValueForAI(value)}`);
                }
            }
        }

        // Add empty line before actual result content
        if (output.results?.content && lines.length > 0) {
            lines.push('');
            lines.push(output.results.content as string);
        }

        return lines.join('\n');
    }

    /**
     * Format value for AI consumption (never truncates)
     */
    private static formatValueForAI(value: unknown): string {
        if (value === null || value === undefined) {
            return ' null';
        }
        if (typeof value === 'boolean') {
            return ` ${value ? 'true' : 'false'}`;
        }
        if (typeof value === 'number') {
            return ` ${value}`;
        }
        if (typeof value === 'string') {
            return ` ${value}`; // Never truncate for AI
        }
        if (value instanceof Error) {
            return ` ${value.message}`;
        }
        // For objects, JSON stringify (no truncation for AI)
        return ` ${JSON.stringify(value)}`;
    }

    /**
     * Format tool output for local display (when detail mode is off)
     */
    static formatForDisplay(output: ToolOutput): string | null {
        return output.friendly || null;
    }

    /**
     * Format a label with consistent alignment
     */
    private static formatLabel(key: string): string {
        // Capitalize first letter and replace underscores with spaces
        const formatted = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
        return `${formatted}:`;
    }

    /**
     * Format a value for display
     */
    private static formatValue(value: unknown): string {
        if (value === null || value === undefined) {
            return ' null';
        }
        if (typeof value === 'boolean') {
            return ` ${value ? 'true' : 'false'}`;
        }
        if (typeof value === 'number') {
            return ` ${value}`;
        }
        if (typeof value === 'string') {
            // Truncate very long strings in non-detail mode
            if (!DetailMode.enabled && value.length > 100) {
                return ` ${value.substring(0, 97)}...`;
            }
            return ` ${value}`;
        }
        if (value instanceof Error) {
            return ` ${value.message}`;
        }
        // For objects, JSON stringify with truncation
        const jsonStr = JSON.stringify(value);
        if (!DetailMode.enabled && jsonStr.length > 100) {
            return ` ${jsonStr.substring(0, 97)}...`;
        }
        return ` ${jsonStr}`;
    }
}
