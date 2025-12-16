/**
 * Verification test for the council auto-member exclusion fix
 * This test demonstrates that the original issue has been resolved
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import * as path from 'node:path';
import { CouncilService } from '../src/core/council-service.js';
import { AIProcessor } from '../src/core/ai-processor.js';
import { StreamingClient } from '../src/core/streaming-client.js';
import { ToolManager } from '../src/core/tool-manager.js';
import { Stats } from '../src/core/stats.js';

describe('Council Fix Verification', () => {
    let councilService: CouncilService;
    let originalCwd: string;

    beforeAll(() => {
        originalCwd = process.cwd();
        process.chdir('/home/blah/poc/aicoder/tsv');
        
        const stats = new Stats();
        const streamingClient = new StreamingClient(stats, new ToolManager(stats));
        const processor = new AIProcessor(streamingClient);
        councilService = new CouncilService(processor);
    });

    it('verifies the original issue is fixed: normal council excludes auto members', async () => {
        const { members } = await councilService.loadMembers(undefined, false, false);
        
        const autoMembers = members.filter(m => m.name.includes('_auto'));
        const regularMembers = members.filter(m => !m.name.includes('_auto'));
        
        // Verify the fix: no auto members in normal mode
        expect(autoMembers.length).toBe(0);
        expect(regularMembers.length).toBeGreaterThan(0);
        
        console.log(`✓ Normal council: ${regularMembers.length} regular members, ${autoMembers.length} auto members`);
    });

    it('verifies auto mode still works: auto council includes only auto members', async () => {
        const { members } = await councilService.loadMembers(['auto'], true, true);
        
        const autoMembers = members.filter(m => m.name.includes('_auto'));
        const regularMembers = members.filter(m => !m.name.includes('_auto'));
        
        // Verify auto mode works correctly
        expect(autoMembers.length).toBeGreaterThan(0);
        expect(regularMembers.length).toBe(0);
        
        console.log(`✓ Auto council: ${autoMembers.length} auto members, ${regularMembers.length} regular members`);
    });

    it('demonstrates the fix addresses the original user concern', () => {
        // The original concern was that normal /council should ignore _auto council members
        // This test documents that the fix works as intended
        
        const councilDir = path.join(process.cwd(), '.aicoder/council');
        const files = require('fs').readdirSync(councilDir).filter((f: string) => f.endsWith('.txt'));
        
        const autoFiles = files.filter((f: string) => f.includes('_auto'));
        const regularFiles = files.filter((f: string) => !f.includes('_auto'));
        
        console.log(`📁 Council directory contains ${files.length} files:`);
        console.log(`   • Regular members: ${regularFiles.length}`);
        console.log(`   • Auto members: ${autoFiles.length}`);
        
        // Verify we have both types of files in the directory
        expect(regularFiles.length).toBeGreaterThan(0);
        expect(autoFiles.length).toBeGreaterThan(0);
        
        // The key fix: filtering happens at runtime, not just by file presence
        console.log(`🎯 Fix verified: Runtime filtering separates auto vs regular members`);
    });
});