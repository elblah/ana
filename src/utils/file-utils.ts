/**
 * Cross-platform file operations with sandbox enforcement
 * All file operations should go through this module
 */

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

interface ConfigInterface {
    readonly debug: boolean;
    readonly sandboxDisabled: boolean;
    readonly colors: Record<string, string>;
}

let Config: ConfigInterface | null = null;

// Dynamic import to avoid circular dependencies
try {
    Config = require('../core/config.js').Config;
} catch {
    // Config not available - will use fallback colors
}

export class FileUtils {
    private static currentDir = process.cwd();
    private static readFiles = new Set<string>();

    /**
     * Check if a path is allowed by sandbox rules
     */
    static checkSandbox(path: string): boolean {
        if (Config?.sandboxDisabled) {
            return true;
        }

        if (!path) return true;

        // Resolve relative paths using Node.js path
        const resolvedPath = resolve(path);

        // Ensure current directory has trailing slash for proper prefix matching
        const currentDirWithSlash = this.currentDir.endsWith('/')
            ? this.currentDir
            : this.currentDir + '/';

        // Check if resolved path is within current directory
        // Must either be exactly the current dir or start with current dir + '/'
        if (!(resolvedPath === this.currentDir || resolvedPath.startsWith(currentDirWithSlash))) {
            console.log(
                `${Config?.colors.yellow || ''}[x] Sandbox: Access to "${resolvedPath}" outside current directory "${this.currentDir}" not allowed${Config?.colors.reset || ''}`
            );
            return false;
        }

        // Also check for obvious parent directory traversal
        if (path.includes('../')) {
            console.log(
                `${Config?.colors.yellow || ''}[x] Sandbox: Path "${path}" contains parent traversal and is not allowed${Config?.colors.reset || ''}`
            );
            return false;
        }

        return true;
    }

    /**
     * Read a file (no sandbox) - default behavior for internal use
     */
    static async readFile(path: string): Promise<string> {
        try {
            let content: string;
            if (typeof Bun !== 'undefined') {
                const file = Bun.file(path);
                if (!(await file.exists())) {
                    throw new Error(`File not found at '${path}'`);
                }
                content = await file.text();
            } else {
                const { readFile } = await import('node:fs/promises');
                content = await readFile(path, 'utf8');
            }
            this.readFiles.add(path);
            return content;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error reading file '${path}': ${error.message}`);
            }
            throw new Error(`Error reading file '${path}': ${error}`);
        }
    }

    /**
     * Read a file with sandbox check - for AI requests only
     */
    static async readFileWithSandbox(path: string): Promise<string> {
        // Check sandbox first
        if (!this.checkSandbox(path)) {
            throw new Error(`Path "${path}" is outside current directory and not allowed`);
        }

        return await this.readFile(path);
    }

    /**
     * Write to a file (no sandbox) - default behavior for internal use
     */
    static async writeFile(path: string, content: string): Promise<string> {
        try {
            // Use appropriate API based on environment
            if (typeof Bun !== 'undefined') {
                await Bun.write(path, content);
            } else {
                const { writeFile } = await import('node:fs/promises');
                await writeFile(path, content, 'utf8');
            }
            const bytes = new TextEncoder().encode(content).length;
            const lines = content.split('\n').length;
            return `Successfully wrote ${bytes} bytes (${lines} lines) to ${path}`;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error writing file '${path}': ${error.message}`);
            }
            throw new Error(`Error writing file '${path}': ${error}`);
        }
    }

    /**
     * Write to a file with sandbox check - for AI requests only
     */
    static async writeFileWithSandbox(path: string, content: string): Promise<string> {
        // Check sandbox first
        if (!this.checkSandbox(path)) {
            throw new Error(`Path "${path}" is outside current directory and not allowed`);
        }

        return await this.writeFile(path, content);
    }

    /**
     * Check if file exists (no sandbox) - default behavior for internal use
     */
    static fileExists(path: string): boolean {
        try {
            if (typeof Bun !== 'undefined') {
                const file = Bun.file(path);
                return file.size > 0; // In Bun, size is 0 if file doesn't exist
            } else {
                return existsSync(path);
            }
        } catch {
            return false;
        }
    }

    /**
     * Check if file exists (async version, no sandbox) - default behavior for internal use
     */
    static async fileExistsAsync(path: string): Promise<boolean> {
        try {
            if (typeof Bun !== 'undefined') {
                const file = Bun.file(path);
                return await file.exists();
            } else {
                const { access } = await import('node:fs/promises');
                await access(path);
                return true;
            }
        } catch {
            return false;
        }
    }

    /**
     * Check if file exists with sandbox check - for AI requests only
     */
    static fileExistsWithSandbox(path: string): boolean {
        // Check sandbox first
        if (!this.checkSandbox(path)) {
            return false;
        }

        return this.fileExists(path);
    }

    /**
     * Check if file exists with sandbox check (async) - for AI requests only
     */
    static async fileExistsWithSandboxAsync(path: string): Promise<boolean> {
        // Check sandbox first
        if (!this.checkSandbox(path)) {
            return false;
        }

        return await this.fileExistsAsync(path);
    }

    /**
     * List directory contents (with sandbox check)
     */
    static async listDirectory(path: string): Promise<string[]> {
        // Resolve path first
        const resolvedPath = path === '.' ? this.currentDir : resolve(path);

        // Check sandbox
        if (!this.checkSandbox(resolvedPath)) {
            throw new Error(
                `Path "${path}" (resolves to "${resolvedPath}") is outside current directory and not allowed`
            );
        }

        try {
            const { readdir } = await import('node:fs/promises');
            const entries = await readdir(resolvedPath, { withFileTypes: true });

            // Filter only files/dirs (no special entries)
            const validEntries = entries
                .filter((entry) => !entry.name.startsWith('.'))
                .filter(
                    (entry) =>
                        !['node_modules', '.git', '.vscode', '.idea', 'dist', 'build'].includes(
                            entry.name
                        )
                );

            return validEntries.map((entry) => entry.name);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error listing directory '${resolvedPath}': ${error.message}`);
            }
            throw new Error(`Error listing directory '${resolvedPath}': ${error}`);
        }
    }

    /**
     * Check if a file was previously read in this session
     */
    static wasFileRead(path: string): boolean {
        return this.readFiles.has(path);
    }

    /**
     * Edit file (simple replace operation - for plugin compatibility)
     */
    static async editFile(path: string, oldString: string, newString: string): Promise<string> {
        const content = await this.readFile(path);
        const newContent = content.replace(oldString, newString);
        return await this.writeFile(path, newContent);
    }

    /**
     * Delete a file (with sandbox check)
     */
    static async deleteFile(path: string): Promise<void> {
        if (!this.checkSandbox(path)) {
            throw new Error(`Path "${path}" is outside current directory and not allowed`);
        }

        try {
            if (typeof Bun !== 'undefined') {
                await Bun.file(path).delete();
            } else {
                const { unlink } = await import('node:fs/promises');
                await unlink(path);
            }
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error deleting file '${path}': ${error.message}`);
            }
            throw new Error(`Error deleting file '${path}': ${error}`);
        }
    }

    /**
     * Get current working directory for debugging
     */
    static getCurrentDir(): string {
        return this.currentDir;
    }

    /**
     * Clear file tracking state (for testing only)
     */
    static clearFileTracking(): void {
        this.readFiles.clear();
    }

    /**
     * Reset all static state (for testing only)
     * Used to ensure complete test isolation
     */
    static resetAllState(): void {
        this.readFiles.clear();
        this.currentDir = process.cwd();
    }
}
