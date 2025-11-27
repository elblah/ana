/**
 * Date and time utilities
 */

export class DateTimeUtils {
    /**
     * Create a filesystem-safe timestamp from current date
     * Format: YYYY-MM-DDTHH-MM-SS (first 19 chars of ISO string with colons replaced)
     */
    static createFileTimestamp(): string {
        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    }

    /**
     * Create a filename with timestamp
     */
    static createTimestampFilename(prefix: string, extension = ''): string {
        const timestamp = this.createFileTimestamp();
        const ext = extension.startsWith('.') ? extension : `.${extension}`;
        return `${prefix}-${timestamp}${ext}`;
    }

    /**
     * Get current ISO datetime string
     */
    static getCurrentISODateTime(): string {
        return new Date().toISOString();
    }
}
