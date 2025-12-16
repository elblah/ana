/**
 * Tests for council auto-member exclusion
 * Uses existing council directory in the project
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CouncilService } from '../src/core/council-service.js';
import { AIProcessor } from '../src/core/ai-processor.js';
import { StreamingClient } from '../src/core/streaming-client.js';
import { ToolManager } from '../src/core/tool-manager.js';
import { Stats } from '../src/core/stats.js';

describe('CouncilService Auto-Member Exclusion', () => {
    let councilService: CouncilService;
    let originalCwd: string;

    beforeAll(() => {
        // Change to project directory to use existing council
        originalCwd = process.cwd();
        process.chdir('/home/blah/poc/aicoder/tsv');
        
        // Setup council service with mock processor
        const stats = new Stats();
        const streamingClient = new StreamingClient(stats, new ToolManager(stats));
        const processor = new AIProcessor(streamingClient);
        councilService = new CouncilService(processor);
    });

    afterAll(() => {
        // Restore original directory
        process.chdir(originalCwd);
    });

    it('should exclude _auto members in normal mode', async () => {
        const { members, moderator } = await councilService.loadMembers(undefined, false, false);
        
        // Get all member names
        const memberNames = members.map(m => m.name);
        const autoMembers = memberNames.filter(name => name.includes('_auto'));
        const regularMembers = memberNames.filter(name => !name.includes('_auto'));
        
        // In normal mode, should have no auto members
        expect(autoMembers.length).toBe(0);
        expect(regularMembers.length).toBeGreaterThan(0);
        
        // If there's a moderator, it should not be auto
        if (moderator) {
            expect(moderator.name).not.toContain('_auto');
        }
    });

    it('should only include _auto members in auto mode', async () => {
        const { members, moderator } = await councilService.loadMembers(['auto'], true, true);
        
        // Get all member names
        const memberNames = members.map(m => m.name);
        const autoMembers = memberNames.filter(name => name.includes('_auto'));
        const regularMembers = memberNames.filter(name => !name.includes('_auto'));
        
        // In auto mode, should only have auto members
        expect(autoMembers.length).toBeGreaterThan(0);
        expect(regularMembers.length).toBe(0);
        
        // If there's a moderator in auto mode, it should be auto
        if (moderator) {
            expect(moderator.name).toContain('_auto');
        }
    });

    it('should respect filters in normal mode while still excluding auto members', async () => {
        // Test with a filter that should match existing council members
        const { members } = await councilService.loadMembers(['security'], false, false);
        
        // All returned members should match filter and not be auto members
        for (const member of members) {
            expect(member.name).toContain('security');
            expect(member.name).not.toContain('_auto');
        }
    });

    it('should verify the council directory structure exists', () => {
        const councilDir = path.join(process.cwd(), '.aicoder/council');
        expect(fs.existsSync(councilDir)).toBe(true);
        
        const files = fs.readdirSync(councilDir).filter(f => f.endsWith('.txt'));
        expect(files.length).toBeGreaterThan(0);
        
        // Should have both regular and auto members
        const autoFiles = files.filter(f => f.includes('_auto'));
        const regularFiles = files.filter(f => !f.includes('_auto'));
        
        expect(autoFiles.length).toBeGreaterThan(0);
        expect(regularFiles.length).toBeGreaterThan(0);
    });

    it('should demonstrate the filtering logic manually', () => {
        const councilDir = path.join(process.cwd(), '.aicoder/council');
        const files = fs.readdirSync(councilDir).filter(f => f.endsWith('.txt'));
        
        // Simulate normal mode filtering (excluding auto members)
        const normalModeFiles = files.filter(file => {
            const name = file.replace('.txt', '');
            return !name.includes('_auto');
        });
        
        // Simulate auto mode filtering (only auto members)
        const autoModeFiles = files.filter(file => {
            const name = file.replace('.txt', '');
            return name.includes('_auto') || name.includes('moderator');
        });
        
        // Verify the logic
        expect(normalModeFiles.some(f => f.includes('_auto'))).toBe(false);
        expect(autoModeFiles.some(f => !f.includes('_auto') && !f.includes('moderator'))).toBe(false);
        
        // Should have files in both modes
        expect(normalModeFiles.length).toBeGreaterThan(0);
        expect(autoModeFiles.length).toBeGreaterThan(0);
    });
});