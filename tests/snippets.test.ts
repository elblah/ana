import { describe, it, expect } from 'bun:test';

describe('Snippet Utils - Basic Tests', () => {
    it('should handle empty input', () => {
        // Just test that the functions exist and don't crash on basic input
        expect(() => {
            const SnippetUtils = require('../src/core/snippet-utils.js');

            // Test that functions are exported
            expect(typeof SnippetUtils.expandSnippets).toBe('function');
            expect(typeof SnippetUtils.loadSnippet).toBe('function');
            expect(typeof SnippetUtils.getSnippetNames).toBe('function');
            expect(typeof SnippetUtils.ensureSnippetsDir).toBe('function');

            // Test basic functionality without mocks
            const result = SnippetUtils.expandSnippets('No snippets here');
            expect(result).toBe('No snippets here');

            // Test that missing snippets don't crash
            const resultWithMissing = SnippetUtils.expandSnippets('@@nonexistent');
            expect(resultWithMissing).toContain('@@nonexistent');
        }).not.toThrow();
    });

    it('should have SNIPPETS_DIR constant', () => {
        const SnippetUtils = require('../src/core/snippet-utils.js');

        expect(SnippetUtils.SNIPPETS_DIR).toBeDefined();
        expect(typeof SnippetUtils.SNIPPETS_DIR).toBe('string');
        expect(SnippetUtils.SNIPPETS_DIR).toContain('aicoder-mini');
        expect(SnippetUtils.SNIPPETS_DIR).toContain('snippets');
    });

    it('should handle multiple snippet patterns', () => {
        const SnippetUtils = require('../src/core/snippet-utils.js');

        // Test with mixed content
        const input = 'Start @@missing1 middle @@missing2 end';
        const result = SnippetUtils.expandSnippets(input);

        // Should keep original text for missing snippets
        expect(result).toContain('@@missing1');
        expect(result).toContain('@@missing2');
    });
});
