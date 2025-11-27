/**
 * Cross-platform temporary file utilities
 */

export class TempFileUtils {
    /**
     * Get system temp directory
     */
    static getTempDir(): string {
        // Try to use local tmp directory first to avoid sandbox issues
        const localTmp = './tmp';
        if (typeof process !== 'undefined' && process.cwd) {
            const localTmpPath = require('node:path').resolve(process.cwd(), localTmp);
            try {
                require('node:fs').mkdirSync(localTmpPath, { recursive: true });
                return localTmpPath;
            } catch (e) {
                // Fall back to other options
            }
        }

        // Try system temp directory
        if (typeof process !== 'undefined' && process.env.TMPDIR) {
            return process.env.TMPDIR;
        }

        // Fallback to /tmp for Unix-like systems
        return '/tmp';
    }

    /**
     * Create a temporary file path
     */
    static createTempFile(prefix: string, suffix = ''): string {
        const tempDir = this.getTempDir();
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 10000);
        const fileName = `${prefix}-${timestamp}-${randomNum}${suffix}`;

        return `${tempDir}/${fileName}`;
    }
    /**
     * Delete a file (returns promise so caller can await or not)
     */
    static deleteFile(path: string): Promise<void> {
        if (typeof Bun !== 'undefined') {
            return Bun.file(path)
                .delete()
                .catch(() => {});
        } else {
            return import('node:fs/promises').then(({ unlink }) => {
                return unlink(path).catch(() => {});
            });
        }
    }

    /**
     * Delete file synchronously
     */
    static deleteFileSync(path: string): void {
        try {
            if (typeof Bun !== 'undefined') {
                Bun.file(path).delete();
            } else {
                const { unlinkSync } = require('node:fs');
                unlinkSync(path);
            }
        } catch (error) {
            // Ignore deletion errors (file might not exist)
        }
    }

    /**
     * Write to temp file and ensure cleanup
     */
    static async writeTempFile(path: string, content: string): Promise<void> {
        if (typeof Bun !== 'undefined') {
            await Bun.write(path, content);
        } else {
            const { writeFile } = await import('node:fs/promises');
            await writeFile(path, content, 'utf8');
        }
    }
}
