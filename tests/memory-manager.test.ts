/**
 * Memory Manager Tests
 */

import { MemoryManager } from '../src/core/memory-manager.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('MemoryManager', () => {
    let memoryManager: MemoryManager;
    let testDir: string;

    beforeEach(() => {
        // Create a unique test directory for each test
        testDir = `.test-memory-${Date.now()}`;
        fs.mkdirSync(testDir, { recursive: true });
        memoryManager = new MemoryManager(testDir);
    });

    afterEach(() => {
        // Clean up test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('Memory File Loading', () => {
        test('should load valid memory file', async () => {
            // Create a valid memory file
            const memoryDir = path.join(testDir, 'memory');
            fs.mkdirSync(memoryDir, { recursive: true });
            const memoryFile = path.join(memoryDir, 'test.json');
            const memoryData = [
                { role: 'user', content: 'Test instruction' },
                { role: 'assistant', content: 'Test response' }
            ];
            
            fs.writeFileSync(memoryFile, JSON.stringify(memoryData));
            
            const messages = await memoryManager.loadSpecificMemory('test.json');
            expect(messages).toEqual(memoryData);
        });

        test('should handle missing file gracefully', async () => {
            const messages = await memoryManager.loadSpecificMemory('nonexistent.json');
            expect(messages).toEqual([]);
        });

        test('should validate message structure', async () => {
            // Create invalid memory file
            const memoryDir = path.join(testDir, 'memory');
            fs.mkdirSync(memoryDir, { recursive: true });
            const memoryFile = path.join(memoryDir, 'invalid.json');
            const invalidData = [
                { role: 'user' }, // Missing content
                { content: 'test' }, // Missing role
                { role: 'invalid', content: 'test' }, // Invalid role
                { role: 'user', content: 'test' } // Valid
            ];
            
            fs.writeFileSync(memoryFile, JSON.stringify(invalidData));
            
            const messages = await memoryManager.loadSpecificMemory('invalid.json');
            expect(messages).toHaveLength(1);
            expect(messages[0]).toEqual({ role: 'user', content: 'test' });
        });

        test('should handle non-array JSON', async () => {
            const memoryDir = path.join(testDir, 'memory');
            fs.mkdirSync(memoryDir, { recursive: true });
            const memoryFile = path.join(memoryDir, 'nonarray.json');
            fs.writeFileSync(memoryFile, JSON.stringify({ not: 'array' }));
            
            const messages = await memoryManager.loadSpecificMemory('nonarray.json');
            expect(messages).toEqual([]);
        });
    });

    describe('Auto-loading Numbered Files', () => {
        test('should load numbered files in correct order', async () => {
            // Create numbered memory files out of order
            const memoryDir = path.join(testDir, 'memory');
            fs.mkdirSync(memoryDir, { recursive: true });
            const files = [
                { name: '3_third.json', order: 3 },
                { name: '1_first.json', order: 1 },
                { name: '2_second.json', order: 2 }
            ];
            
            for (const file of files) {
                const filePath = path.join(memoryDir, file.name);
                const data = [{ role: 'user', content: `Memory ${file.order}` }];
                fs.writeFileSync(filePath, JSON.stringify(data));
            }
            
            const messages = await memoryManager.loadAutoLoadMemories();
            expect(messages).toHaveLength(3);
            expect(messages[0].content).toBe('Memory 1');
            expect(messages[1].content).toBe('Memory 2');
            expect(messages[2].content).toBe('Memory 3');
        });

        test('should skip non-numbered files', async () => {
            // Create numbered and non-numbered files
            const memoryDir = path.join(testDir, 'memory');
            fs.mkdirSync(memoryDir, { recursive: true });
            const numberedFile = path.join(memoryDir, '1_numbered.json');
            const nonNumberedFile = path.join(memoryDir, 'regular.json');
            
            fs.writeFileSync(numberedFile, JSON.stringify([{ role: 'user', content: 'Numbered' }]));
            fs.writeFileSync(nonNumberedFile, JSON.stringify([{ role: 'user', content: 'Regular' }]));
            
            const messages = await memoryManager.loadAutoLoadMemories();
            expect(messages).toHaveLength(1);
            expect(messages[0].content).toBe('Numbered');
        });

        test('should handle gaps in numbering', async () => {
            // Create files with gaps (1 and 3, missing 2)
            const memoryDir = path.join(testDir, 'memory');
            fs.mkdirSync(memoryDir, { recursive: true });
            const file1 = path.join(memoryDir, '1_first.json');
            const file3 = path.join(memoryDir, '3_third.json');
            
            fs.writeFileSync(file1, JSON.stringify([{ role: 'user', content: 'First' }]));
            fs.writeFileSync(file3, JSON.stringify([{ role: 'user', content: 'Third' }]));
            
            const messages = await memoryManager.loadAutoLoadMemories();
            expect(messages).toHaveLength(2);
            expect(messages[0].content).toBe('First');
            expect(messages[1].content).toBe('Third');
        });
    });

    describe('File Management', () => {
        test('should list memory files', async () => {
            // Create some test files
            const memoryDir = path.join(testDir, 'memory');
            fs.mkdirSync(memoryDir, { recursive: true });
            const files = ['1_test.json', '2_test.json', 'custom.json'];
            for (const file of files) {
                fs.writeFileSync(path.join(memoryDir, file), JSON.stringify([]));
            }
            
            const fileList = await memoryManager.listMemoryFiles();
            expect(fileList).toHaveLength(3);
            expect(fileList).toContain('1_test.json');
            expect(fileList).toContain('2_test.json');
            expect(fileList).toContain('custom.json');
        });

        test('should check file existence', async () => {
            // Create a test file
            const memoryDir = path.join(testDir, 'memory');
            fs.mkdirSync(memoryDir, { recursive: true });
            const testFile = path.join(memoryDir, 'exists.json');
            fs.writeFileSync(testFile, JSON.stringify([]));
            
            expect(await memoryManager.memoryFileExists('exists.json')).toBe(true);
            expect(await memoryManager.memoryFileExists('exists')).toBe(true); // Without extension
            expect(await memoryManager.memoryFileExists('nonexistent.json')).toBe(false);
        });
    });

    describe('Singleton Pattern', () => {
        test('should return same instance', () => {
            const instance1 = MemoryManager.getInstance();
            const instance2 = MemoryManager.getInstance();
            expect(instance1).toBe(instance2);
        });
    });
});