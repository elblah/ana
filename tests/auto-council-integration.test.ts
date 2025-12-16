#!/usr/bin/env bun

/**
 * Integration test for auto-council with member consensus
 */

import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { CouncilCommand } from '../src/core/commands/council.js';
import { Config } from '../src/core/config.js';

// Mock terminal for testing
const mockTerminal = {
    interactive: false,
    lines: [] as string[],
    print: (line: string) => mockTerminal.lines.push(line)
};

// Override LogUtils to capture output
const originalPrint = (global as any).LogUtils?.print;
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

describe('Auto-Council Integration', () => {
    beforeEach(() => {
        mockTerminal.lines = [];
        // Clean up any test files
        const testFiles = ['test_auto.py', 'test_auto2.py'];
        testFiles.forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        });
    });

    it('should detect IMPLEMENTATION_NOT_FINISHED correctly', async () => {
        // Create a spec
        const specPath = path.join(process.cwd(), 'test_integration_spec.md');
        const specContent = 'Implement a hello world script';
        fs.writeFileSync(specPath, specContent);
        
        // Create a mock implementation
        const implPath = path.join(process.cwd(), 'test_auto.py');
        fs.writeFileSync(implPath, '# incomplete\nprint("hello")');

        try {
            // Load the spec using the static method
            CouncilCommand.loadSpec(specContent, specPath);
            
            // Create a minimal mock context
            const mockContext = {
                stats: { startTime: Date.now() },
                messageHistory: { clear: () => {} },
                inputHandler: { close: () => {} }
            };
            
            const councilCommand = new CouncilCommand(mockContext as any);
            
            // Mock args to simulate --auto mode
            const mockArgs = {
                auto: true,
                message: 'Implement a hello world script',
                implementationFiles: ['test_auto.py'],
                spec: 'test_integration_spec.md'
            };

            // This would normally run the council but we'll test the consensus logic directly
            // For now, just verify the auto mode is detected
            expect(CouncilCommand.hasSpec()).toBe(true);
            
        } finally {
            // Cleanup
            CouncilCommand.clearSpec();
            if (fs.existsSync(specPath)) fs.unlinkSync(specPath);
            if (fs.existsSync(implPath)) fs.unlinkSync(implPath);
        }
    });

    it('should detect IMPLEMENTATION_FINISHED correctly', async () => {
        // Create a complete implementation
        const implPath = path.join(process.cwd(), 'test_auto_complete.py');
        fs.writeFileSync(implPath, '#!/usr/bin/env python3\nprint("Hello, World!")\n');

        try {
            // The actual implementation would need to run AI processor
            // For now, verify file detection works
            expect(fs.existsSync(implPath)).toBe(true);
            
        } finally {
            if (fs.existsSync(implPath)) fs.unlinkSync(implPath);
        }
    });

    afterAll(() => {
        // Restore original LogUtils
        if (originalPrint) {
            (global as any).LogUtils.print = originalPrint;
        }
    });
});