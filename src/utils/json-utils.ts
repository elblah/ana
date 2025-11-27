/**
 * JSON utilities for cross-platform file operations
 */

import { FileUtils } from './file-utils.js';

export class JsonUtils {
    /**
     * Write JSON data to file (pretty formatted)
     */
    static async writeFile(path: string, data: unknown): Promise<string> {
        const content = JSON.stringify(data, null, 2);
        return await FileUtils.writeFile(path, content);
    }

    /**
     * Read and parse JSON from file
     */
    static async readFile<T = Record<string, unknown>>(path: string): Promise<T> {
        const content = await FileUtils.readFile(path);
        return JSON.parse(content) as T;
    }

    /**
     * Read and parse JSON from file (safe version)
     */
    static async readFileSafe<T = Record<string, unknown>>(path: string): Promise<T | null> {
        try {
            const content = await FileUtils.readFile(path);
            return JSON.parse(content) as T;
        } catch (error) {
            return null;
        }
    }

    /**
     * Validate JSON string
     */
    static isValid(jsonString: string): boolean {
        try {
            JSON.parse(jsonString);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Parse JSON string safely
     */
    static parseSafe<T = Record<string, unknown>>(jsonString: string): T | null {
        try {
            return JSON.parse(jsonString) as T;
        } catch {
            return null;
        }
    }
}
