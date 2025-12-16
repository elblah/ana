#!/usr/bin/env bun

/**
 * Test member consensus voting
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { CouncilService } from '../src/core/council-service';
import { CouncilMember } from '../src/core/types/council';

// Mock dependencies
const mockProcessor = {
    processMessages: async (messages: any[], prompt: string) => {
        // Return a test opinion based on the member name
        if (prompt.includes('ImplementationFinished_Member1')) {
            return 'This looks good.\n\nIMPLEMENTATION_FINISHED';
        } else if (prompt.includes('ImplementationFinished_Member2')) {
            return 'I think we need more work.\n\nIMPLEMENTATION_NOT_FINISHED';
        } else if (prompt.includes('ImplementationFinished_Member3')) {
            return 'Everything is complete.\n\nIMPLEMENTATION_FINISHED';
        }
        return 'Looks OK.\n\nIMPLEMENTATION_NOT_FINISHED';
    }
};

describe('Member Consensus', () => {
    let councilService: CouncilService;
    
    beforeEach(() => {
        councilService = new CouncilService(mockProcessor as any);
    });

    it('should require unanimous FINISHED votes for consensus', async () => {
        // Create test members
        const members = [
            { name: 'ImplementationFinished_Member1', auto: true, role: 'moderator', prompt: 'Test' },
            { name: 'ImplementationFinished_Member2', auto: true, role: 'moderator', prompt: 'Test' },
            { name: 'ImplementationFinished_Member3', auto: true, role: 'moderator', prompt: 'Test' }
        ] as CouncilMember[];

        // Start session and get opinions
        await councilService.startSession([], members);
        for (const member of members) {
            await councilService.getMemberOpinion(member);
        }

        // Get consensus
        const consensus = await councilService.getMemberConsensus();
        
        // Should be NOT_FINISHED because not all members voted FINISHED
        expect(consensus).toBe('IMPLEMENTATION_NOT_FINISHED');
    });

    it('should return FINISHED when all members vote FINISHED', async () => {
        // Create test members
        const members = [
            { name: 'AllFinished_Member1', auto: true, role: 'moderator', prompt: 'Test' },
            { name: 'AllFinished_Member2', auto: true, role: 'moderator', prompt: 'Test' },
            { name: 'AllFinished_Member3', auto: true, role: 'moderator', prompt: 'Test' }
        ] as CouncilMember[];

        // Mock all to return FINISHED
        mockProcessor.processMessages = async () => {
            return 'Perfect implementation.\n\nIMPLEMENTATION_FINISHED';
        };

        // Start session and get opinions
        await councilService.startSession([], members);
        for (const member of members) {
            await councilService.getMemberOpinion(member);
        }

        // Get consensus
        const consensus = await councilService.getMemberConsensus();
        
        // Should be FINISHED because all members voted FINISHED
        expect(consensus).toBe('IMPLEMENTATION_FINISHED');
    });

    it('should handle missing votes gracefully', async () => {
        // Create test members
        const members = [
            { name: 'VoteMember1', auto: true, role: 'moderator', prompt: 'Test' },
            { name: 'NoVoteMember2', auto: true, role: 'moderator', prompt: 'Test' }
        ] as CouncilMember[];

        // Mock responses
        mockProcessor.processMessages = async (messages: any[], prompt: string) => {
            if (prompt.includes('VoteMember1')) {
                return 'This is complete.\n\nIMPLEMENTATION_FINISHED';
            } else {
                return 'I have some thoughts but no clear vote'; // No vote line
            }
        };

        // Start session and get opinions
        await councilService.startSession([], members);
        for (const member of members) {
            await councilService.getMemberOpinion(member);
        }

        // Get consensus
        const consensus = await councilService.getMemberConsensus();
        
        // Should be NOT_FINISHED because not all members voted FINISHED
        expect(consensus).toBe('IMPLEMENTATION_NOT_FINISHED');
    });
});