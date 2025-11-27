/**
 * Path utilities for security and validation
 */

export class PathUtils {
    /**
     * Check if a path is safe (no parent directory traversal)
     */
    static isSafePath(path: string): boolean {
        // Check for obvious parent directory traversal
        return !path.includes('../');
    }

    /**
     * Validate path and log security warning if unsafe
     */
    static validatePath(path: string, context = 'operation'): boolean {
        if (!this.isSafePath(path)) {
            console.log(
                `\x1b[33m[x] Sandbox: ${context} trying to access "${path}" (contains parent traversal)\x1b[0m`
            );
            return false;
        }
        return true;
    }

    /**
     * Validate path for tools with specific logging format
     */
    static validateToolPath(path: string, toolName: string): boolean {
        if (!this.isSafePath(path)) {
            console.log(
                `\x1b[33m[x] Sandbox-fs: ${toolName} trying to access "${path}" outside current directory\x1b[0m`
            );
            return false;
        }
        return true;
    }
}
