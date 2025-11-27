/**
 * Web Search Plugin for AI Coder
 *
 * Simple web search using lynx browser.
 * No parsing, no complexity - just raw text content to the AI.
 */

import type { Plugin, PluginContext, PluginTool } from '../../src/core/plugin-system.js';
import type { ToolExecutionArgs, ToolParameters, ToolOutput } from '../../src/core/types.js';

// Configuration
const DEFAULT_LINES_PER_PAGE = 500;

// Tool definitions
const WEB_SEARCH_TOOL_DEFINITION: ToolParameters = {
    type: 'object',
    properties: {
        query: {
            type: 'string',
            description: 'Search query string.',
        },
    },
    required: ['query'],
};

const URL_CONTENT_TOOL_DEFINITION: ToolParameters = {
    type: 'object',
    properties: {
        url: {
            type: 'string',
            description: 'The URL to fetch content from (https only).',
        },
        page: {
            type: 'integer',
            description:
                'Page number to fetch (1-based, default: 1). Use pagination for large content.',
            minimum: 1,
            default: 1,
        },
    },
    required: ['url'],
};

/**
 * Validate URL to prevent shell injection
 */
function validateUrl(url: string): boolean {
    // Basic URL validation - allow only http/https with safe characters
    const urlPattern = /^https?:\/\/[a-zA-Z0-9\-._~:\/?#[\]@!()*+,;=%]+$/;
    return urlPattern.test(url);
}

/**
 * Fetch paginated text content from a URL using lynx -dump with sed
 */
async function fetchUrlTextPaginated(
    url: string,
    page: number = 1,
    linesPerPage: number = DEFAULT_LINES_PER_PAGE
): Promise<string> {
    // Validate inputs
    if (!validateUrl(url)) {
        throw new Error('Invalid URL format');
    }
    if (!Number.isInteger(page) || page < 1) {
        throw new Error('Invalid page number');
    }
    if (!Number.isInteger(linesPerPage) || linesPerPage < 1) {
        throw new Error('Invalid lines per page');
    }

    // Calculate line range for the requested page
    const startLine = (page - 1) * linesPerPage + 1;
    const endLine = page * linesPerPage;

    // Check if lynx is available
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    try {
        await execAsync('which lynx');
    } catch {
        throw new Error(
            'lynx browser is not installed. Please install it with: sudo apt install lynx'
        );
    }

    // Use lynx + sed to get the specific page
    const { stdout, stderr } = await execAsync(
        `lynx -dump "${url}" | sed -n '${startLine},${endLine}p'`,
        {
            timeout: 30000,
        }
    );

    if (stderr) {
        throw new Error(stderr.trim());
    }

    return stdout.trim();
}

async function executeWebSearch(args: ToolExecutionArgs): Promise<ToolOutput> {
    const { query, max_results = 5 } = args;

    if (!query || !query.trim()) {
        return {
            tool: 'web_search',
            friendly: 'Error: Search query cannot be empty.',
            results: {
                error: 'Search query cannot be empty',
                showWhenDetailOff: true,
            },
        };
    }

    try {
        const encodedQuery = encodeURIComponent(query.trim());
        const searchUrl = `https://duckduckgo.com/lite/?q=${encodedQuery}`;
        const content = await fetchUrlTextPaginated(searchUrl, 1, DEFAULT_LINES_PER_PAGE);

        return {
            tool: 'web_search',
            friendly: `Web search completed for query: ${query}`,
            important: {
                query: query,
                search_url: searchUrl,
            },
            detailed: {
                raw_content: content,
            },
            results: {
                content: `Web search results for "${query}":\n\n${content}`,
                showWhenDetailOff: false,
            },
        };
    } catch (error) {
        return {
            tool: 'web_search',
            friendly: `Error performing web search: ${error instanceof Error ? error.message : String(error)}`,
            results: {
                error: error instanceof Error ? error.message : String(error),
                showWhenDetailOff: true,
            },
        };
    }
}

async function executeGetUrlContent(args: ToolExecutionArgs): Promise<ToolOutput> {
    const { url, page = 1 } = args;

    if (!url || !url.trim()) {
        return {
            tool: 'get_url_content',
            friendly: 'Error: URL cannot be empty.',
            results: {
                error: 'URL cannot be empty',
                showWhenDetailOff: true,
            },
        };
    }

    let processedUrl = url.trim();

    // Check if HTTP is allowed via environment variable
    const allowHttp =
        process.env.ALLOW_HTTP?.toLowerCase() === '1' ||
        process.env.ALLOW_HTTP?.toLowerCase() === 'true' ||
        process.env.ALLOW_HTTP?.toLowerCase() === 'yes';

    // Process URL based on ALLOW_HTTP setting
    if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
        // Auto-add protocol based on setting
        processedUrl = allowHttp ? `http://${processedUrl}` : `https://${processedUrl}`;
    } else if (!allowHttp && processedUrl.startsWith('http://')) {
        // Upgrade http:// to https:// only if HTTP is not allowed
        processedUrl = `https://${processedUrl.substring(7)}`;
    }

    try {
        const content = await fetchUrlTextPaginated(processedUrl, page, DEFAULT_LINES_PER_PAGE);

        return {
            tool: 'get_url_content',
            friendly: `Fetched content from ${processedUrl} (page ${page}, ${content.length} characters)`,
            important: {
                url: processedUrl,
                page: page,
                lines_per_page: DEFAULT_LINES_PER_PAGE,
                content_length: content.length,
            },
            detailed: {
                raw_content: content,
            },
            results: {
                content: content,
                showWhenDetailOff: false,
            },
        };
    } catch (error) {
        if (error instanceof Error && error.message.includes('timeout')) {
            return {
                tool: 'get_url_content',
                friendly: `Error: Request to '${processedUrl}' timed out after 30 seconds.`,
                results: {
                    error: `Request to '${processedUrl}' timed out after 30 seconds.`,
                    showWhenDetailOff: true,
                },
            };
        }
        return {
            tool: 'get_url_content',
            friendly: `Error fetching URL content: ${error instanceof Error ? error.message : String(error)}`,
            results: {
                error: error instanceof Error ? error.message : String(error),
                showWhenDetailOff: true,
            },
        };
    }
}

// Plugin creation function
export default function createWebSearchPlugin(ctx: PluginContext): Plugin {
    return {
        name: 'Web Search Plugin',
        version: '1.0.0',
        description: 'Web search capability and URL content fetching',
        initialize: () => {
            console.log('Web Search Plugin: Enabled web search and URL content tools');
        },
        cleanup: () => {
            // Cleanup logic if needed
        },
        getTools: (): PluginTool[] => [
            {
                name: 'web_search',
                description: 'Search web for information',
                parameters: WEB_SEARCH_TOOL_DEFINITION,
                execute: executeWebSearch,
                auto_approved: true,
            },
            {
                name: 'get_url_content',
                description: 'Fetch the full text content of an URL',
                parameters: URL_CONTENT_TOOL_DEFINITION,
                execute: executeGetUrlContent,
                auto_approved: undefined,
            },
        ],
    };
}
