import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CouncilService } from '../src/core/council-service';
import { AIProcessor } from '../src/core/ai-processor';

describe('CouncilService Auto-Mode Filtering Bug Fix', () => {
    let councilService: CouncilService;
    let testDir: string;

    beforeEach(async () => {
        councilService = new CouncilService({} as AIProcessor);
        testDir = path.join(process.cwd(), '.test-council-' + Math.random().toString(36).substr(2, 9));
        fs.mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('Deactivated member filtering (files starting with _)', () => {
        beforeEach(() => {
            // Setup test council directory with mixed files
            fs.writeFileSync(path.join(testDir, 'regular_member.txt'), 'Regular member');
            fs.writeFileSync(path.join(testDir, 'auto_member_auto.txt'), 'Auto member');
            fs.writeFileSync(path.join(testDir, '_disabled_member.txt'), 'Disabled member');
            fs.writeFileSync(path.join(testDir, '_disabled_member_auto.txt'), 'Disabled auto member');
            fs.writeFileSync(path.join(testDir, 'moderator.txt'), 'Regular moderator');
            fs.writeFileSync(path.join(testDir, 'auto_moderator.txt'), 'Auto moderator');
        });

        test('should filter out _ prefixed files in normal mode when includeDisabled=false', async () => {
            const result = await councilService['loadMembersFromDirectory'](testDir, [], false, false, false);
            
            const memberNames = result.members.map(m => m.name);
            expect(memberNames).not.toContain('_disabled_member');
            expect(memberNames).not.toContain('_disabled_auto');
            expect(result.moderator?.name).not.toBe('_disabled_moderator');
        });

        test('should include _ prefixed files in normal mode when includeDisabled=true', async () => {
            const result = await councilService['loadMembersFromDirectory'](testDir, [], false, false, true);
            
            const memberNames = result.members.map(m => m.name);
            expect(memberNames).toContain('_disabled_member');
            expect(memberNames).toContain('_disabled_member_auto');
            // Note: disabled moderator is never included even with includeDisabled=true
        });

        test('should filter out _ prefixed files in auto mode when includeDisabled=false', async () => {
            const result = await councilService['loadMembersFromDirectory'](testDir, [], false, true, false);
            
            const memberNames = result.members.map(m => m.name);
            expect(memberNames).not.toContain('_disabled_member');
            expect(memberNames).not.toContain('_disabled_member_auto');
            expect(result.moderator?.name).not.toBe('_disabled_moderator');
        });

        test('should only include auto members in auto mode (excluding _ prefixed)', async () => {
            const result = await councilService['loadMembersFromDirectory'](testDir, [], false, true, false);
            
            const memberNames = result.members.map(m => m.name);
            expect(memberNames).toEqual(['auto_member_auto']);
            expect(result.moderator?.name).toBe('auto_moderator');
        });

        test('should only include regular members in normal mode (excluding _ prefixed)', async () => {
            const result = await councilService['loadMembersFromDirectory'](testDir, [], false, false, false);
            
            const memberNames = result.members.map(m => m.name);
            // auto_member_auto is excluded by auto-mode filtering logic
            expect(memberNames).toEqual(['regular_member']);
            expect(result.moderator?.name).toBe('moderator');
        });
    });

    describe('Integration with cached directory', () => {
        test('should maintain filtering when using cached directory', async () => {
            // Setup test directory with disabled files
            fs.writeFileSync(path.join(testDir, 'active_auto.txt'), 'Active auto');
            fs.writeFileSync(path.join(testDir, '_disabled_auto.txt'), 'Disabled auto');
            fs.writeFileSync(path.join(testDir, 'auto_moderator.txt'), 'Auto moderator');

            // Set the cached directory
            CouncilService['lastSuccessfulCouncilDir'] = testDir;

            // Load members using cached directory in auto mode
            const result = await councilService.loadMembers([], false, true);

            const memberNames = result.members.map(m => m.name);
            expect(memberNames).toEqual(['active_auto']);
            expect(result.moderator?.name).toBe('auto_moderator');
            expect(memberNames).not.toContain('_disabled_auto');
        });
    });

    describe('Edge cases', () => {
        test('should handle empty directory with cached path', async () => {
            CouncilService['lastSuccessfulCouncilDir'] = testDir;
            
            const result = await councilService.loadMembers([], false, true);
            
            expect(result.members).toEqual([]);
            expect(result.moderator).toBeNull();
        });

        test('should handle only disabled files', async () => {
            fs.writeFileSync(path.join(testDir, '_disabled1.txt'), 'Disabled 1');
            fs.writeFileSync(path.join(testDir, '_disabled2.txt'), 'Disabled 2');

            const result = await councilService['loadMembersFromDirectory'](testDir, [], false, true, false);
            
            expect(result.members).toEqual([]);
            expect(result.moderator).toBeNull();
        });
    });
});