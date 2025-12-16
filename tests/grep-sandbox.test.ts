/**
 * Test grep tool sandbox enforcement
 */

import { describe, it, expect } from 'bun:test';
import { executeGrep, TOOL_DEFINITION } from '../src/tools/internal/grep.js';

describe('grep tool sandbox', () => {

    it('should block access to parent directory', async () => {
        const result = await executeGrep({
            text: 'test',
            path: '../',
        });

        expect(result.friendly).toContain('✗ Failed to search:');
        expect(result.friendly).toContain('outside current directory not allowed');
    });

    it('should block access to absolute path outside current directory', async () => {
        const result = await executeGrep({
            text: 'test',
            path: '/etc/passwd',
        });

        expect(String(result.results.error)).toContain('outside current directory not allowed');
        expect(result.friendly).toContain('✗ Failed to search:');
    });

    it('should allow access to current directory', async () => {
        const result = await executeGrep({
            text: 'test',
            path: '.',
        });

        expect(result.results.error).toBeUndefined();
    });

    it('should allow access to subdirectory', async () => {
        const result = await executeGrep({
            text: 'test',
            path: 'src',
        });

        expect(result.results.error).toBeUndefined();
    });

    it('should block obvious directory traversal', async () => {
        const result = await executeGrep({
            text: 'test',
            path: '../../../etc',
        });

        expect(result.results.error).toContain('path \"../../../etc\" outside current directory not allowed');
        expect(result.friendly).toContain('✗ Failed to search:');
    });


});
