import { Config } from '../core/config.js';

interface LogOptions {
    color?: string;
    debug?: boolean;
    bold?: boolean;
}

/**
 * Minimal logging utility for consistent output formatting
 */
export class LogUtils {
    /**
     * Print message with optional formatting
     * @param message Message to print
     * @param options Optional formatting options
     */
    static print(message: string, options?: LogOptions): void {
        const { color, debug = false, bold = false } = options || {};

        if (debug && !Config.debug) {
            return;
        }

        if (color) {
            const format = bold ? Config.colors.bold + color : color;
            console.log(`${format}${message}${Config.colors.reset}`);
        } else if (bold) {
            console.log(`${Config.colors.bold}${message}${Config.colors.reset}`);
        } else {
            console.log(message);
        }
    }

    /**
     * Print error message (always shows, red by default)
     */
    static error(message: string): void {
        this.print(message, { color: Config.colors.red });
    }

    /**
     * Print success message (always shows, green by default)
     */
    static success(message: string): void {
        this.print(message, { color: Config.colors.green });
    }

    /**
     * Print warning message (always shows, yellow by default)
     */
    static warn(message: string): void {
        this.print(message, { color: Config.colors.yellow });
    }

    /**
     * Print debug message (only shows when debug enabled)
     */
    static debug(message: string, color?: string): void {
        this.print(message, { color: color || Config.colors.yellow, debug: true });
    }
}
