#!/usr/bin/env bun

/**
 * Test that decision parsing correctly identifies FINISHED vs NOT_FINISHED
 */

import { describe, it, expect } from 'bun:test';

describe('Council Decision Parsing', () => {
    it('should correctly identify IMPLEMENTATION_FINISHED decision', () => {
        const finalPlan = `# Council Consensus

## Member1
Looks good.

IMPLEMENTATION_FINISHED

## Member2
Perfect.

IMPLEMENTATION_FINISHED

---

## Vote Summary:
- IMPLEMENTATION_FINISHED: 2
- IMPLEMENTATION_NOT_FINISHED: 0
- NO_VOTE: 0

## Final Decision: IMPLEMENTATION_FINISHED`;

        const lines = finalPlan.split('\n');
        const decisionLine = lines.find(line => 
            line.trim().startsWith('## Final Decision:')
        );
        // Extract the decision from the "## Final Decision:" line
        const decision = decisionLine?.replace('## Final Decision:', '').trim();
        const isFinished = decision === 'IMPLEMENTATION_FINISHED';
        
        expect(isFinished).toBe(true);
    });

    it('should correctly identify IMPLEMENTATION_NOT_FINISHED decision', () => {
        const finalPlan = `# Council Consensus

## Member1
Needs more work.

IMPLEMENTATION_NOT_FINISHED

## Member2
Not ready yet.

IMPLEMENTATION_NOT_FINISHED

---

## Vote Summary:
- IMPLEMENTATION_FINISHED: 0
- IMPLEMENTATION_NOT_FINISHED: 2
- NO_VOTE: 0

## Final Decision: IMPLEMENTATION_NOT_FINISHED`;

        const lines = finalPlan.split('\n');
        const decisionLine = lines.find(line => 
            line.trim().startsWith('## Final Decision:')
        );
        // Extract the decision from the "## Final Decision:" line
        const decision = decisionLine?.replace('## Final Decision:', '').trim();
        const isFinished = decision === 'IMPLEMENTATION_FINISHED';
        
        expect(isFinished).toBe(false);
    });

    it('should not be fooled by IMPLEMENTATION_FINISHED appearing in summary', () => {
        const finalPlan = `# Council Consensus

## Member1
Good work.

IMPLEMENTATION_FINISHED

## Member2
More work needed.

IMPLEMENTATION_NOT_FINISHED

---

## Vote Summary:
- IMPLEMENTATION_FINISHED: 1
- IMPLEMENTATION_NOT_FINISHED: 1
- NO_VOTE: 0

## Final Decision: IMPLEMENTATION_NOT_FINISHED`;

        // The old buggy logic would find 'IMPLEMENTATION_FINISHED' in the summary
        const buggyLogic = finalPlan.includes('IMPLEMENTATION_FINISHED');
        expect(buggyLogic).toBe(true); // This is the bug!
        
        // The new fixed logic should correctly identify the final decision
        const lines = finalPlan.split('\n');
        const decisionLine = lines.find(line => 
            line.trim().startsWith('## Final Decision:')
        );
        // Extract the decision from the "## Final Decision:" line
        const decision = decisionLine?.replace('## Final Decision:', '').trim();
        const isFinished = decision === 'IMPLEMENTATION_FINISHED';
        expect(isFinished).toBe(false); // This is the correct behavior
    });

    it('should handle missing decision line gracefully', () => {
        const finalPlan = `# Council Consensus

## Member1
Some opinion

## Member2
Another opinion

No decision here`;

        const lines = finalPlan.split('\n');
        const decisionLine = lines.find(line => 
            line.trim().startsWith('## Final Decision:')
        );
        // Extract the decision from the "## Final Decision:" line
        const decision = decisionLine?.replace('## Final Decision:', '').trim();
        const isFinished = decision === 'IMPLEMENTATION_FINISHED';
        
        expect(isFinished).toBe(false);
        expect(decisionLine).toBeUndefined();
    });
});