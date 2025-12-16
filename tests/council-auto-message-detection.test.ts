#!/usr/bin/env bun

/**
 * Test for council auto-mode message detection functionality
 * Tests: /council --auto <file_or_message> with space detection logic
 */

import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { CouncilCommand } from '../src/core/commands/council.js';
import { TestEnvironment } from './test-utils.js';

// Mock terminal for testing
const mockTerminal = {
    interactive: false,
    lines: [] as string[],
    print: (line: string) => mockTerminal.lines.push(line)
};

// Override LogUtils to capture output
const originalLogUtils = (global as any).LogUtils;
(global as any).LogUtils = {
    print: (message: string, options?: any) => {
        mockTerminal.print(message);
    },
    warn: (message: string, options?: any) => {
        mockTerminal.print(`WARN: ${message}`);
    },
    error: (message: string, options?: any) => {
        mockTerminal.print(`ERROR: ${message}`);
    }
};

describe('Council Auto Message Detection', () => {
    let tempDir: string;
    let testSpecPath: string;
    let currentSpecPath: string;

    beforeEach(async () => {
        mockTerminal.lines = [];
        
        // Setup test environment
        tempDir = await TestEnvironment.setup();
        testSpecPath = path.join(tempDir, 'test-spec.md');
        currentSpecPath = path.join(tempDir, '.aicoder', 'current-spec.md');
        
        // Create .aicoder directory
        const aicoderDir = path.join(tempDir, '.aicoder');
        if (!fs.existsSync(aicoderDir)) {
            fs.mkdirSync(aicoderDir, { recursive: true });
        }
        
        // Clear any existing spec
        CouncilCommand.clearSpec();
    });

    afterAll(() => {
        // Restore original LogUtils
        if (originalLogUtils) {
            (global as any).LogUtils = originalLogUtils;
        }
    });

    describe('Space Detection Logic', () => {
        it('should treat argument with spaces as text content', async () => {
            const textContent = 'Implement a simple hello world function in TypeScript';
            
            // Change to temp directory for test
            const originalCwd = process.cwd();
            process.chdir(tempDir);
            
            try {
                // Create mock context
                const mockContext = {
                    stats: { startTime: Date.now() },
                    messageHistory: { 
                        getMessages: () => [],
                        addUserMessage: () => {}
                    },
                    aiCoder: { setNextPrompt: () => {} }
                };
                
                const councilCommand = new CouncilCommand(mockContext as any);
                
                // Simulate --auto with text content (has spaces)
                const result = await councilCommand.execute(['--auto', textContent]);
                
                // Verify spec was loaded correctly
                expect(CouncilCommand.hasSpec()).toBe(true);
                expect(CouncilCommand.getCurrentSpec()).toBe(textContent);
                expect(CouncilCommand.getCurrentSpecFile()).toBe(currentSpecPath);
                
                // Verify file was created
                expect(fs.existsSync(currentSpecPath)).toBe(true);
                const savedContent = fs.readFileSync(currentSpecPath, 'utf-8');
                expect(savedContent).toBe(textContent);
                
                // The fact that the file contains the exact text content proves text mode was triggered
                // If file mode was used, it would have tried to read a file named "Implement a user login system"
                // which doesn't exist, so this confirms the space detection worked correctly
                
            } finally {
                process.chdir(originalCwd);
            }
        });

        it('should treat argument without spaces as file path', async () => {
            const specContent = 'Implement a simple function';
            const fileName = 'test-spec.md';
            
            // Create test spec file
            fs.writeFileSync(testSpecPath, specContent);
            
            // Change to temp directory for test
            const originalCwd = process.cwd();
            process.chdir(tempDir);
            
            try {
                // Create mock context
                const mockContext = {
                    stats: { startTime: Date.now() },
                    messageHistory: { 
                        getMessages: () => [],
                        addUserMessage: () => {}
                    },
                    aiCoder: { setNextPrompt: () => {} }
                };
                
                const councilCommand = new CouncilCommand(mockContext as any);
                
                // Simulate --auto with file name (no spaces)
                const result = await councilCommand.execute(['--auto', fileName]);
                
                // Verify spec was loaded from file
                expect(CouncilCommand.hasSpec()).toBe(true);
                expect(CouncilCommand.getCurrentSpec()).toBe(specContent);
                expect(CouncilCommand.getCurrentSpecFile()).toBe(currentSpecPath);
                
                // Verify working spec file was created
                expect(fs.existsSync(currentSpecPath)).toBe(true);
                const savedContent = fs.readFileSync(currentSpecPath, 'utf-8');
                expect(savedContent).toBe(specContent);
                
                // The fact that the working spec contains the file's content (not the literal string "test-spec.md")
                // proves that file mode was triggered and the file was read successfully
                // This confirms space detection worked correctly for file paths
                
            } finally {
                process.chdir(originalCwd);
            }
        });

        it('should handle single word without spaces as file path', async () => {
            const specContent = 'Single word spec';
            const fileName = 'spec.md';
            const testSpecPath = path.join(tempDir, fileName);
            
            // Create test spec file in temp directory
            fs.writeFileSync(testSpecPath, specContent);
            
            // Change to temp directory for test
            const originalCwd = process.cwd();
            process.chdir(tempDir);
            
            try {
                // Create mock context
                const mockContext = {
                    stats: { startTime: Date.now() },
                    messageHistory: { 
                        getMessages: () => [],
                        addUserMessage: () => {}
                    },
                    aiCoder: { setNextPrompt: () => {} }
                };
                
                const councilCommand = new CouncilCommand(mockContext as any);
                
                // Simulate --auto with single word file name (no spaces)
                const result = await councilCommand.execute(['--auto', fileName]);
                
                // Verify spec was loaded from file by checking the working spec file
                expect(fs.existsSync(currentSpecPath)).toBe(true);
                const savedContent = fs.readFileSync(currentSpecPath, 'utf-8');
                expect(savedContent).toBe(specContent);
                
            } finally {
                process.chdir(originalCwd);
            }
        });

        it('should handle multiple words with spaces as text content', async () => {
            const textContent = 'This is a multi-word specification with many spaces';
            
            // Change to temp directory for test
            const originalCwd = process.cwd();
            process.chdir(tempDir);
            
            try {
                // Create mock context
                const mockContext = {
                    stats: { startTime: Date.now() },
                    messageHistory: { 
                        getMessages: () => [],
                        addUserMessage: () => {}
                    },
                    aiCoder: { setNextPrompt: () => {} }
                };
                
                const councilCommand = new CouncilCommand(mockContext as any);
                
                // Simulate --auto with multi-word text content
                const result = await councilCommand.execute(['--auto', textContent]);
                
                // Verify spec was loaded as text content
                expect(CouncilCommand.hasSpec()).toBe(true);
                expect(CouncilCommand.getCurrentSpec()).toBe(textContent);
                expect(CouncilCommand.getCurrentSpecFile()).toBe(currentSpecPath);
                
                // Verify file was created with text content
                expect(fs.existsSync(currentSpecPath)).toBe(true);
                const savedContent = fs.readFileSync(currentSpecPath, 'utf-8');
                expect(savedContent).toBe(textContent);
                
            } finally {
                process.chdir(originalCwd);
            }
        });
    });

    describe('Error Handling', () => {
        it('should show error when non-existent file is specified', async () => {
            const fileName = 'non-existent.md';
            
            // Change to temp directory for test
            const originalCwd = process.cwd();
            process.chdir(tempDir);
            
            try {
                // Create mock context
                const mockContext = {
                    stats: { startTime: Date.now() },
                    messageHistory: { 
                        getMessages: () => [],
                        addUserMessage: () => {}
                    },
                    aiCoder: { setNextPrompt: () => {} }
                };
                
                const councilCommand = new CouncilCommand(mockContext as any);
                
                // Simulate --auto with non-existent file (no spaces, treated as file)
                const result = await councilCommand.execute(['--auto', fileName]);
                
                // Verify no spec file was created (since file doesn't exist)
                expect(fs.existsSync(currentSpecPath)).toBe(false);
                
                // Verify no spec was loaded
                expect(CouncilCommand.hasSpec()).toBe(false);
                
            } finally {
                process.chdir(originalCwd);
            }
        });

        it('should show error when no argument provided', async () => {
            // Change to temp directory for test
            const originalCwd = process.cwd();
            process.chdir(tempDir);
            
            try {
                // Create mock context
                const mockContext = {
                    stats: { startTime: Date.now() },
                    messageHistory: { 
                        getMessages: () => [],
                        addUserMessage: () => {}
                    },
                    aiCoder: { setNextPrompt: () => {} }
                };
                
                const councilCommand = new CouncilCommand(mockContext as any);
                
                // Simulate --auto with no argument
                const result = await councilCommand.execute(['--auto']);
                
                // Verify no spec file was created (since no argument provided)
                expect(fs.existsSync(currentSpecPath)).toBe(false);
                
                // Verify no spec was loaded
                expect(CouncilCommand.hasSpec()).toBe(false);
                
            } finally {
                process.chdir(originalCwd);
            }
        });
    });

    describe('.aicoder Directory Creation', () => {
        it('should create .aicoder directory when saving text content', async () => {
            const textContent = 'Test specification content';
            const aicoderDir = path.join(tempDir, '.aicoder');
            
            // Remove .aicoder directory if it exists
            if (fs.existsSync(aicoderDir)) {
                fs.rmSync(aicoderDir, { recursive: true });
            }
            
            // Change to temp directory for test
            const originalCwd = process.cwd();
            process.chdir(tempDir);
            
            try {
                // Create mock context
                const mockContext = {
                    stats: { startTime: Date.now() },
                    messageHistory: { 
                        getMessages: () => [],
                        addUserMessage: () => {}
                    },
                    aiCoder: { setNextPrompt: () => {} }
                };
                
                const councilCommand = new CouncilCommand(mockContext as any);
                
                // Verify .aicoder directory doesn't exist
                expect(fs.existsSync(aicoderDir)).toBe(false);
                
                // Simulate --auto with text content
                const result = await councilCommand.execute(['--auto', textContent]);
                
                // Verify .aicoder directory was created
                expect(fs.existsSync(aicoderDir)).toBe(true);
                expect(fs.existsSync(currentSpecPath)).toBe(true);
                
                // Verify content was saved
                const savedContent = fs.readFileSync(currentSpecPath, 'utf-8');
                expect(savedContent).toBe(textContent);
                
            } finally {
                process.chdir(originalCwd);
            }
        });
    });

    describe('Backward Compatibility', () => {
        it('should maintain existing file path behavior', async () => {
            const specContent = 'Legacy file specification';
            const fileName = 'legacy-spec.md';
            const testSpecPath = path.join(tempDir, fileName);
            
            // Create test spec file in temp directory
            fs.writeFileSync(testSpecPath, specContent);
            
            // Change to temp directory for test
            const originalCwd = process.cwd();
            process.chdir(tempDir);
            
            try {
                // Create mock context
                const mockContext = {
                    stats: { startTime: Date.now() },
                    messageHistory: { 
                        getMessages: () => [],
                        addUserMessage: () => {}
                    },
                    aiCoder: { setNextPrompt: () => {} }
                };
                
                const councilCommand = new CouncilCommand(mockContext as any);
                
                // Simulate legacy --auto with file name
                const result = await councilCommand.execute(['--auto', fileName]);
                
                // Verify behavior matches original implementation by checking file operations
                expect(fs.existsSync(currentSpecPath)).toBe(true);
                
                // Verify file mode was triggered correctly by checking content
                const savedContent = fs.readFileSync(currentSpecPath, 'utf-8');
                expect(savedContent).toBe(specContent);
                
            } finally {
                process.chdir(originalCwd);
            }
        });
    });
});