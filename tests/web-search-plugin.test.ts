/**
 * Test for Web Search Plugin
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import createWebSearchPlugin from '../plugins/web-search/web-search.js';
import { Config } from '../src/core/config.js';

// Store original process methods
const originalExec = require('node:child_process').exec;
const originalUtil = require('node:util').promisify;
const originalEnv = process.env;

// Mock plugin context
const mockContext = {
    config: Config,
    getConfig: (key: string) => Config[key as keyof typeof Config],
    setConfig: (key: string, value: any) => { Config[key as keyof typeof Config] = value; },
    registerCommand: () => {},
    addUserMessage: () => {},
    addSystemMessage: () => {},
    registerNotifyHooks: () => {}
};

// Mock shell command responses
const mockShellResponses: Record<string, { stdout: string; stderr: string }> = {
    // Mock DuckDuckGo search results
    'curl -s "https://duckduckgo.com/lite/?q=test+search"': {
        stdout: `<!DOCTYPE html>
<html>
<head><title>DuckDuckGo Lite</title></head>
<body>
<div class="result-link">
    <a rel="nofollow" href="//duckduckgo.com/l/?uddg=https://example.com/test1">Test Result 1</a>
    <a rel="nofollow" href="//duckduckgo.com/l/?uddg=https://example.com/test2">Test Result 2</a>
</div>
</body>
</html>`,
        stderr: ''
    },
    // Mock lynx output for URL content
    'lynx -dump -nolist -width 120 "https://example.com/test1"': {
        stdout: `Test Page 1 Content

This is the full text content of the test page.
It includes multiple lines and formatting.

Key information:
- Important fact 1
- Important fact 2
- Important fact 3

More detailed content follows here.`,
        stderr: ''
    },
    'lynx -dump -nolist -width 120 "https://example.com/test2"': {
        stdout: `Test Page 2 Content

Different test page with other information.
Contains relevant details for the search query.

Additional data points:
- Secondary information
- Supporting evidence
- Contextual details`,
        stderr: ''
    },
    // Mock which lynx command
    'which lynx': {
        stdout: '/usr/bin/lynx',
        stderr: ''
    }
};

// Mock exec and promisify
const mockExecAsync = async (command: string) => {
    const response = mockShellResponses[command];
    if (response) {
        return response;
    }
    
    // Default error response for unmocked commands
    return {
        stdout: '',
        stderr: 'Command not found in mock'
    };
};

describe('Web Search Plugin', () => {
    let plugin: ReturnType<typeof createWebSearchPlugin>;

    beforeEach(() => {
        // Mock child_process exec
        const childProcess = require('node:child_process');
        const util = require('node:util');
        
        // Store original exec
        const originalExec = childProcess.exec;
        const originalPromisify = util.promisify;
        
        // Mock promisify to return our mock function
        util.promisify = (fn: any) => {
            if (fn === originalExec) {
                return mockExecAsync;
            }
            return originalPromisify(fn);
        };
        
        // Set test environment
        process.env = { ...originalEnv };
        
        plugin = createWebSearchPlugin(mockContext);
    });

    afterEach(() => {
        // Restore original methods
        const childProcess = require('node:child_process');
        const util = require('node:util');
        util.promisify = require('node:util').promisify;
        process.env = originalEnv;
    });

    it('should create plugin with correct metadata', () => {
        expect(plugin.name).toBe('Web Search Plugin');
        expect(plugin.version).toBe('1.0.0');
        expect(plugin.description).toBe('Web search capability using DuckDuckGo Lite and URL content fetching');
    });

    it('should provide web search tool', () => {
        const tools = plugin.getTools?.();
        expect(tools).toBeDefined();
        expect(tools?.length).toBe(2);

        const webSearchTool = tools?.find(t => t.name === 'web_search');
        expect(webSearchTool).toBeDefined();
        expect(webSearchTool?.description).toBe('Search the web for information using DuckDuckGo');
        expect(webSearchTool?.parameters.required).toContain('query');
        expect(webSearchTool?.parameters.properties.query).toBeDefined();
        expect(webSearchTool?.parameters.properties.max_results).toBeDefined();
    });

    it('should provide URL content tool', () => {
        const tools = plugin.getTools?.();
        const urlContentTool = tools?.find(t => t.name === 'get_url_content');
        expect(urlContentTool).toBeDefined();
        expect(urlContentTool?.description).toBe('Fetch and read the full text content of a URL using lynx browser');
        expect(urlContentTool?.parameters.required).toContain('url');
    });

    it('should handle empty search query', async () => {
        const tools = plugin.getTools?.();
        const webSearchTool = tools?.find(t => t.name === 'web_search');
        
        if (webSearchTool) {
            const result = await webSearchTool.execute({ query: '' });
            expect(result.tool).toBe('web_search');
            expect(result.results?.error).toContain('Search query cannot be empty');
        }
    });

    it('should handle empty URL', async () => {
        const tools = plugin.getTools?.();
        const urlContentTool = tools?.find(t => t.name === 'get_url_content');
        
        if (urlContentTool) {
            const result = await urlContentTool.execute({ url: '' });
            expect(result.tool).toBe('get_url_content');
            expect(result.results?.error).toContain('URL cannot be empty');
        }
    });

    it('should perform web search and return results', async () => {
        const tools = plugin.getTools?.();
        const webSearchTool = tools?.find(t => t.name === 'web_search');
        
        if (webSearchTool) {
            const result = await webSearchTool.execute({ 
                query: 'test search',
                max_results: 2
            });
            
            expect(result.tool).toBe('web_search');
            expect(result.important?.totalResults).toBe(2);
            expect(result.important?.results).toHaveLength(2);
            
            // Check first result
            const firstResult = result.important?.results[0];
            expect(firstResult?.title).toBe('Test Result 1');
            expect(firstResult?.url).toBe('https://example.com/test1');
            
            // Check AI-readable content
            expect(result.results?.content).toContain('Web search results for "test search"');
            expect(result.results?.content).toContain('Test Result 1');
            expect(result.results?.content).toContain('https://example.com/test1');
        }
    });

    it('should fetch URL content', async () => {
        const tools = plugin.getTools?.();
        const urlContentTool = tools?.find(t => t.name === 'get_url_content');
        
        if (urlContentTool) {
            const result = await urlContentTool.execute({ 
                url: 'https://example.com/test1'
            });
            
            expect(result.tool).toBe('get_url_content');
            expect(result.important?.url).toBe('https://example.com/test1');
            expect(result.important?.content).toContain('Test Page 1 Content');
            expect(result.important?.content).toContain('Important fact 1');
            
            // Check AI-readable content
            expect(result.results?.content).toContain('Content from https://example.com/test1');
            expect(result.results?.content).toContain('Test Page 1 Content');
            expect(result.results?.content).toContain('Important fact 1');
        }
    });

    it('should handle shell command errors gracefully', async () => {
        // Mock a failed shell command
        (Bun as any).$ = () => Promise.resolve({
            text: () => Promise.resolve(''),
            exitCode: 1
        });
        
        const tools = plugin.getTools?.();
        const webSearchTool = tools?.find(t => t.name === 'web_search');
        
        if (webSearchTool) {
            const result = await webSearchTool.execute({ 
                query: 'test search'
            });
            
            expect(result.tool).toBe('web_search');
            expect(result.results?.error).toContain('No results found');
        }
    });

    it('should handle URL fetch errors gracefully', async () => {
        // Mock a failed URL fetch
        (Bun as any).$ = (command: string) => {
            if (command.includes('lynx')) {
                return Promise.resolve({
                    text: () => Promise.resolve(''),
                    exitCode: 1
                });
            }
            return mockShell(command);
        };
        
        const tools = plugin.getTools?.();
        const urlContentTool = tools?.find(t => t.name === 'get_url_content');
        
        if (urlContentTool) {
            const result = await urlContentTool.execute({ 
                url: 'https://example.com/nonexistent'
            });
            
            expect(result.tool).toBe('get_url_content');
            expect(result.results?.error).toContain('Failed to fetch URL');
        }
    });

    it('should initialize without errors', () => {
        expect(() => plugin.initialize?.()).not.toThrow();
    });

    it('should cleanup without errors', () => {
        expect(() => plugin.cleanup?.()).not.toThrow();
    });

    it('should respect max_results parameter', async () => {
        const tools = plugin.getTools?.();
        const webSearchTool = tools?.find(t => t.name === 'web_search');
        
        if (webSearchTool) {
            const result = await webSearchTool.execute({ 
                query: 'test search',
                max_results: 1
            });
            
            expect(result.tool).toBe('web_search');
            expect(result.important?.totalResults).toBe(1);
            expect(result.important?.results).toHaveLength(1);
        }
    });

    it('should have auto_approved setting for web_search tool', () => {
        const tools = plugin.getTools?.();
        const webSearchTool = tools?.find(t => t.name === 'web_search');
        
        expect(webSearchTool?.auto_approved).toBe(true);
    });

    it('should not have auto_approved setting for get_url_content tool', () => {
        const tools = plugin.getTools?.();
        const urlContentTool = tools?.find(t => t.name === 'get_url_content');
        
        expect(urlContentTool?.auto_approved).toBeUndefined();
    });
});