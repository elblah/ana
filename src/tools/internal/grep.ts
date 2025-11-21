/**
 * Grep internal tool implementation using ripgrep when available
 */

import { Stats } from '../../core/stats.js';
import { Config } from '../../core/config.js';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { ToolFormatter, ToolOutput } from '../../core/tool-formatter.js';

export interface GrepParams {
  text: string;
  path?: string;
  max_results?: number;
  context?: number;
}

export const TOOL_DEFINITION = {
  type: 'internal',
  auto_approved: true,
  approval_excludes_arguments: false,
  approval_key_exclude_arguments: [],
  hide_results: false,
  description: 'Search text in files using ripgrep with line numbers. Path defaults to current directory.',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text to search for.',
      },
      path: {
        type: 'string',
        description: 'Directory path to search in (defaults to current directory).',
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of results (defaults to 2000).',
      },
      context: {
        type: 'number',
        description: 'Number of lines to show before/after match (defaults to 2).',
      },
    },
    required: ['text'],
    additionalProperties: false,
  },
  formatArguments: (args: GrepParams): string => {
    const parts: string[] = [];
    parts.push(`Text: "${args.text}"`);
    if (args.path && args.path !== '.') {
      parts.push(`Path: ${args.path}`);
    }
    if (args.max_results !== undefined && args.max_results !== 2000) {
      parts.push(`Max results: ${args.max_results}`);
    }
    if (args.context !== undefined && args.context !== 2) {
      parts.push(`Context: ${args.context} lines`);
    }
    return parts.join('\n  ');
  },
};

const MAX_RESULTS = 2000;

/**
 * Execute grep operation
 */
export async function executeGrep(
  params: GrepParams,
  stats: Stats
): Promise<ToolOutput> {
  const startTime = Date.now();
  const { text, path = '.', max_results = MAX_RESULTS, context = 2 } = params;

  try {
    // Validate search text
    if (!text.trim()) {
      stats.incrementToolErrors();
      const errorOutput: ToolOutput = {
        tool: 'grep',
        important: {
          text: text
        },
        results: {
          error: 'Search text cannot be empty.',
          showWhenDetailOff: true
        }
      };
      return errorOutput;
    }

    // Resolve path using Node.js
    const searchPath = resolve(process.cwd(), path);

    // Use ripgrep with node:child_process
    const proc = spawn('rg', [
      '-n',           // Line numbers
      '--max-count', max_results.toString(),
      '-C', context.toString(), // Context lines
      text,
      searchPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    return new Promise((resolve, reject) => {
      proc.on('close', (code: number | null) => {
        const duration = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
        
        if (code === 0 && stdout) {
          // Count matches
          const matchCount = stdout.split('\n').filter(line => line.trim()).length;
          
          const output: ToolOutput = {
            tool: 'grep',
            friendly: matchCount === 0
              ? `No matches found for "${text}" in "${path}"`
              : matchCount === 1
              ? `Found 1 match for "${text}" in "${path}"`
              : `Found ${matchCount} matches for "${text}" in "${path}"`,
            important: {
              text: text
            },
            detailed: {
              path: path,
              max_results: max_results,
              context: context,
              duration: `${duration}s`
            },
            results: {
              match_count: matchCount,
              matches: stdout,
              showWhenDetailOff: false // Don't show actual matches by default
            }
          };

          stats.addToolTime(duration);
          stats.incrementToolCalls();
          resolve(output);
        } else if (code === 1 && !stdout) {
          const output: ToolOutput = {
            tool: 'grep',
            friendly: `No matches found for "${text}" in "${path}"`,
            important: {
              text: text
            },
            detailed: {
              path: path,
              duration: `${duration}s`
            },
            results: {
              match_count: 0,
              message: `No matches found for "${text}" in "${path}"`,
              showWhenDetailOff: true // Show "no matches" message even in simple mode
            }
          };

          stats.incrementToolErrors();
          stats.addToolTime(duration);
          resolve(output);
        } else {
          const errorOutput: ToolOutput = {
            tool: 'grep',
            friendly: `Search error: ${stderr || `exit code ${code}`}`,
            important: {
              text: text
            },
            detailed: {
              path: path,
              duration: `${duration}s`
            },
            results: {
              error: `Error searching: ${stderr || `exit code ${code}`}`,
              showWhenDetailOff: true
            }
          };

          stats.incrementToolErrors();
          stats.addToolTime(duration);
          resolve(errorOutput);
        }
      });

      proc.on('error', (error: Error) => {
        stats.incrementToolErrors();
        stats.addToolTime((Date.now() - startTime) / 1000);
        const errorOutput: ToolOutput = {
          tool: 'grep',
          friendly: `Search failed: ${error.message}`,
          important: {
            text: text
          },
          results: {
            error: `Error searching: ${error.message}`,
            showWhenDetailOff: true
          }
        };
        resolve(errorOutput);
      });
    });

  } catch (error) {
    const duration = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
    stats.incrementToolErrors();
    stats.addToolTime(duration);
    const errorOutput: ToolOutput = {
      tool: 'grep',
      friendly: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      important: {
        text: text
      },
      results: {
        error: `Error searching: ${error instanceof Error ? error.message : String(error)}`,
        showWhenDetailOff: true
      }
    };
    return errorOutput;
  }
}