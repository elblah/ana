/**
 * Centralized file operations with sandbox enforcement
 * All file operations should go through this module
 */

import { Config } from './config.js';

export class FileUtils {
    private static currentDir = process.cwd();
    private static readFiles = new Set<string>();

    /**
     * Check if a path is allowed by sandbox rules
     */
    static checkSandbox(path: string, context = 'file operation'): boolean {
        if (Config.sandboxDisabled) {
            return true;
        }

        if (!path) return true;

        // Resolve relative paths
        const { resolve } = require('node:path');
        const resolvedPath = resolve(path);

        // Ensure current directory has trailing slash for proper prefix matching
        const currentDirWithSlash = this.currentDir.endsWith('/')
            ? this.currentDir
            : this.currentDir + '/';

        // Check if resolved path is within current directory
        // Must either be exactly the current dir or start with current dir + '/'
        if (!(resolvedPath === this.currentDir || resolvedPath.startsWith(currentDirWithSlash))) {
            console.log(
                `${Config.colors.yellow}[x] Sandbox: ${context} trying to access "${resolvedPath}" outside current directory "${this.currentDir}"${Config.colors.reset}`
            );
            return false;
        }

        // Also check for obvious parent directory traversal
        if (path.includes('../')) {
            console.log(
                `${Config.colors.yellow}[x] Sandbox: ${context} trying to access "${path}" (contains parent traversal)${Config.colors.reset}`
            );
            return false;
        }

        return true;
    }

    /**
     * Read a file (with sandbox check)
     */
    static async readFile(path: string): Promise<string> {
        // Check sandbox first
        if (!this.checkSandbox(path, 'read_file')) {
            throw new Error(`read_file: path "${path}" outside current directory not allowed`);
        }

        try {
            let content: string;
            if (typeof Bun !== 'undefined') {
                const file = Bun.file(path);
                if (!file.exists()) {
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
     * Write to a file (with sandbox check)
     */
    static async writeFile(path: string, content: string): Promise<string> {
        // Check sandbox first
        if (!this.checkSandbox(path, 'write_file')) {
            throw new Error(`write_file: path "${path}" outside current directory not allowed`);
        }

        try {
            // Try Bun first, fallback to Node.js
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
     * Check if file exists (with sandbox check)
     */
    static fileExists(path: string): boolean {
        // Check sandbox first
        if (!this.checkSandbox(path, 'file_exists')) {
            return false;
        }

        try {
            if (typeof Bun !== 'undefined') {
                const file = Bun.file(path);
                return file.size > 0; // size is 0 if file doesn't exist
            } else {
                // Node.js fallback - sync check
                const { existsSync } = require('node:fs');
                return existsSync(path);
            }
        } catch {
            return false;
        }
    }

    /**
     * List directory contents (with sandbox check)
     */
    static async listDirectory(path: string): Promise<string[]> {
        // Resolve path first
        const { resolve } = require('node:path');
        const resolvedPath = path === '.' ? this.currentDir : resolve(path);

        // Check sandbox
        if (!this.checkSandbox(resolvedPath, 'list_directory')) {
            throw new Error(
                `list_directory: path "${path}" (resolves to "${resolvedPath}") outside current directory not allowed`
            );
        }

        try {
            const {
                promises: { readdir, stat },
            } = await import('node:fs');
            const entries = Array.from(await readdir(resolvedPath, { withFileTypes: true }));

            // Filter only files/dirs (no special entries)
            const validEntries = entries
                .filter((entry) => {
                    if (!entry.name.startsWith('.')) {
                        return true;
                    }
                    return false;
                })
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
     * Edit a file by replacing text (with sandbox check)
     */
    static async editFile(path: string, oldString: string, newString: string): Promise<string> {
        // Check sandbox first
        if (!this.checkSandbox(path, 'edit_file')) {
            throw new Error(
                `Sandbox violation: Cannot edit file outside current directory - ${path}`
            );
        }

        const { readFile } = require('node:fs/promises');

        // Read current content
        const currentContent = await readFile(path, 'utf-8');

        // Check if old string exists
        if (!currentContent.includes(oldString)) {
            throw new Error(`Old string not found in file: ${path}`);
        }

        // Replace old string with new string
        const newContent = currentContent.replace(oldString, newString);

        // Write the modified content
        await this.writeFile(path, newContent);

        return `Successfully edited ${path}: replaced text`;
    }

    /**
     * Get current working directory for debugging
     */
    static getCurrentDir(): string {
        return this.currentDir;
    }
}
