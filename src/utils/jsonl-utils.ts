/**
 * JSONL utilities for session persistence
 */

import { FileUtils } from './file-utils.js';
import type { Message } from '../core/types/index.js';

export class JsonlUtils {
    /**
     * Write a single message to JSONL file (append mode)
     */
    static async appendMessage(path: string, message: Message): Promise<void> {
        const line = JSON.stringify(message);
        await FileUtils.appendFile(path, line + '\n');
    }

    /**
     * Write all messages to JSONL file (overwrite mode)
     */
    static async writeMessages(path: string, messages: Message[]): Promise<void> {
        const lines = messages.map(msg => JSON.stringify(msg)).join('\n');
        await FileUtils.writeFile(path, lines + (messages.length > 0 ? '\n' : ''));
    }

    /**
     * Read and parse JSONL from file
     */
    static async readFile(path: string): Promise<Message[]> {
        const content = await FileUtils.readFile(path);
        
        if (!content.trim()) {
            return [];
        }

        const lines = content.split('\n').filter(line => line.trim() !== '');
        const messages: Message[] = [];

        for (const line of lines) {
            try {
                const message = JSON.parse(line);
                messages.push(message);
            } catch (error) {
                throw new Error(`Invalid JSONL line in ${path}: ${error}`);
            }
        }

        return messages;
    }

    /**
     * Read and parse JSONL from file (safe version)
     */
    static async readFileSafe(path: string): Promise<Message[] | null> {
        try {
            return await this.readFile(path);
        } catch (error) {
            return null;
        }
    }
}