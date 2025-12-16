/**
 * Memory Manager - Handles behavioral memory injection and management
 */

import { LogUtils } from '../utils/log-utils.js';
import { FileUtils } from '../utils/file-utils.js';
import { JsonUtils } from '../utils/json-utils.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface MemoryMessage {
    role: 'user' | 'assistant';
    content: string;
}

export class MemoryManager {
    private memoryDir: string;
    private static instance: MemoryManager | null = null;

    constructor(baseDir: string = '.aicoder') {
        this.memoryDir = path.join(baseDir, 'memory');
    }

    static getInstance(baseDir?: string): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager(baseDir);
        }
        return MemoryManager.instance;
    }

    /**
     * Ensure memory directory exists
     */
    private ensureMemoryDir(): void {
        if (!fs.existsSync(this.memoryDir)) {
            fs.mkdirSync(this.memoryDir, { recursive: true });
        }
    }

    /**
     * Validate memory message structure
     */
    private validateMemoryMessage(obj: any): obj is MemoryMessage {
        return (
            obj &&
            typeof obj === 'object' &&
            typeof obj.role === 'string' &&
            (obj.role === 'user' || obj.role === 'assistant') &&
            typeof obj.content === 'string'
        );
    }

    /**
     * Load and parse a single memory file
     */
    private async loadMemoryFile(filePath: string): Promise<MemoryMessage[]> {
        try {
            if (!await FileUtils.fileExistsAsync(filePath)) {
                LogUtils.warn(`Memory file not found: ${filePath}`);
                return [];
            }

            const file = Bun.file(filePath);
            const content = await file.text();
            const data = JSON.parse(content);

            if (!Array.isArray(data)) {
                LogUtils.error(`Invalid memory file format (expected array): ${filePath}`);
                return [];
            }

            const validMessages: MemoryMessage[] = [];
            for (let i = 0; i < data.length; i++) {
                if (this.validateMemoryMessage(data[i])) {
                    validMessages.push(data[i]);
                } else {
                    LogUtils.warn(`Invalid message at index ${i} in ${filePath}, skipping`);
                }
            }

            return validMessages;

        } catch (error) {
            LogUtils.error(`Failed to load memory file ${filePath}: ${error}`);
            return [];
        }
    }

    /**
     * Load all numbered memory files in numerical order
     */
    async loadAutoLoadMemories(): Promise<MemoryMessage[]> {
        this.ensureMemoryDir();

        try {
            const files = fs.readdirSync(this.memoryDir);
            
            // Filter for numbered files (1_name.json, 2_name.json, etc.) but NOT underscored files
            const numberedFiles = files.filter(file => {
                const match = file.match(/^(\d+)_.*\.json$/);
                return match !== null && !file.startsWith('_');
            });

            // Sort by numerical prefix
            numberedFiles.sort((a, b) => {
                const aNum = parseInt(a.match(/^(\d+)_/)![1]);
                const bNum = parseInt(b.match(/^(\d+)_/)![1]);
                return aNum - bNum;
            });

            const allMessages: MemoryMessage[] = [];
            let loadedCount = 0;

            for (const file of numberedFiles) {
                const filePath = path.join(this.memoryDir, file);
                const messages = await this.loadMemoryFile(filePath);
                
                if (messages.length > 0) {
                    allMessages.push(...messages);
                    loadedCount++;
                    LogUtils.debug(`Loaded memory file: ${file} (${messages.length} messages)`);
                }
            }

            if (loadedCount > 0) {
                LogUtils.print(`Auto-loaded ${loadedCount} memory files with ${allMessages.length} total messages`, {
                    color: 'green'
                });
            }

            return allMessages;

        } catch (error) {
            LogUtils.error(`Failed to load memory directory: ${error}`);
            return [];
        }
    }

    /**
     * Load a specific memory file by name (with or without .json extension)
     */
    async loadSpecificMemory(fileName: string): Promise<MemoryMessage[]> {
        this.ensureMemoryDir();

        // Add .json extension if not present
        if (!fileName.endsWith('.json')) {
            fileName += '.json';
        }

        const filePath = path.join(this.memoryDir, fileName);
        const messages = await this.loadMemoryFile(filePath);

        if (messages.length > 0) {
            LogUtils.print(`Loaded memory file: ${fileName} (${messages.length} messages)`, {
                color: 'green'
            });
        }

        return messages;
    }

    /**
     * Get list of available memory files
     */
    async listMemoryFiles(): Promise<string[]> {
        this.ensureMemoryDir();

        try {
            const files = fs.readdirSync(this.memoryDir);
            return files.filter(file => file.endsWith('.json')).sort();
        } catch (error) {
            LogUtils.error(`Failed to list memory files: ${error}`);
            return [];
        }
    }

    /**
     * Check if memory file exists
     */
    async memoryFileExists(fileName: string): Promise<boolean> {
        this.ensureMemoryDir();

        if (!fileName.endsWith('.json')) {
            fileName += '.json';
        }

        const filePath = path.join(this.memoryDir, fileName);
        return await FileUtils.fileExistsAsync(filePath);
    }
}