/**
 * Write file internal tool implementation using centralized file utils
 */

import { Stats } from '../../core/stats.js';
import { FileUtils } from '../../core/file-utils.js';
import { ToolFormatter, ToolOutput, ToolPreview } from '../../core/tool-formatter.js';
import { TempUtils } from '../../core/temp-utils.js';

export interface WriteFileParams {
  path: string;
  content: string;
}

export const TOOL_DEFINITION = {
  type: 'internal',
  auto_approved: false,
  approval_excludes_arguments: false,
  approval_key_exclude_arguments: [],
  hide_results: false,
  description: 'Writes complete content to a file, creating directories as needed.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The file system path where to write the content.',
      },
      content: {
        type: 'string',
        description: 'The content to write to the file.',
      },
    },
    required: ['path', 'content'],
    additionalProperties: false,
  },
  formatArguments: (args: WriteFileParams): string => {
    const lines: string[] = [];
    lines.push(`Path: ${args.path}`);
    const contentPreview = args.content.length > 100
      ? args.content.substring(0, 100) + `... (${args.content.length} chars total)`
      : args.content;
    lines.push(`Content: ${contentPreview}`);
    return lines.join('\n  ');
  },
  generatePreview: async (args: WriteFileParams): Promise<ToolPreview | null> => {
    const { path, content } = args;
    
    try {
      // Check if file exists
      const exists = FileUtils.fileExists(path);
      let diffContent = '';
      
      // Create temporary files for diff
      const tempOld = TempUtils.createTempFile('old', '.txt');
      const tempNew = TempUtils.createTempFile('new', '.txt');
      
      // Write content to temp files
      if (exists) {
        const existingContent = await FileUtils.readFile(path);
        await Bun.write(tempOld, existingContent);
      } else {
        // For new files, write empty content to old file
        await Bun.write(tempOld, '');
      }
      await Bun.write(tempNew, content);
      
      // Generate diff using system diff command
      const diffResult = Bun.spawnSync(['diff', '-u', tempOld, tempNew], {
        stdout: 'pipe',
        stderr: 'pipe'
      });
      
      if (diffResult.exitCode === 0) {
        diffContent = 'No changes - file content is identical';
      } else if (diffResult.exitCode === 1) {
        // Differences found - get raw diff output
        diffContent = new TextDecoder().decode(diffResult.stdout);
      } else {
        diffContent = `Error generating diff: ${new TextDecoder().decode(diffResult.stderr)}`;
      }
      
      // Cleanup temp files
      await Bun.file(tempOld).delete().catch(() => {});
      await Bun.file(tempNew).delete().catch(() => {});
      
      return {
        tool: 'write_file',
        summary: exists ? `Modify existing file: ${path}` : `Create new file: ${path}`,
        content: diffContent,
        warning: exists && !FileUtils.wasFileRead(path) 
          ? 'File exists but was not read first - potential overwrite'
          : undefined,
        canApprove: true,
        isDiff: true
      };
      
    } catch (error) {
      return {
        tool: 'write_file',
        summary: `Write to file: ${path}`,
        content: `Error generating preview: ${error instanceof Error ? error.message : String(error)}`,
        warning: 'Preview generation failed',
        canApprove: false
      };
    }
  },
};

/**
 * Execute write file operation
 */
export async function executeWriteFile(
  params: WriteFileParams,
  stats: Stats
): Promise<ToolOutput> {
  try {
    const { path, content } = params;

    // Use FileUtils for sandboxed file writing
    let result: string;
    try {
      result = await FileUtils.writeFile(path, content);
    } catch (error) {
      stats.incrementToolErrors();
      // Create error output
      const errorOutput: ToolOutput = {
        tool: 'write_file',
        friendly: `ERROR: Failed to write '${path}': ${error instanceof Error ? error.message : String(error)}`,
        important: {
          path: path
        },
        detailed: {
          content_length: content.length
        },
        results: {
          error: error instanceof Error ? error.message : String(error),
          showWhenDetailOff: true // Show errors even in simple mode
        }
      };
      return errorOutput;
    }

    // Get file size
    const bytes = Buffer.byteLength(content, 'utf8');
    const lines = content.split('\n').length;

    // Create formatted output with better messaging
    const output: ToolOutput = {
      tool: 'write_file',
      friendly: `✓ Created '${path}' (${lines} lines, ${bytes} bytes)`,
      important: {
        path: path
      },
      detailed: {
        content_length: content.length,
        bytes: bytes,
        lines: lines
      },
      results: {
        success: true,
        message: result,
        showWhenDetailOff: true // Show write success even in simple mode
      }
    };

    stats.incrementToolCalls();
    stats.addToolTime(0.01); // Rough timing estimate

    // Return ToolOutput object
    return output;

  } catch (error) {
    stats.incrementToolErrors();
    const errorOutput: ToolOutput = {
      tool: 'write_file',
      friendly: `ERROR: Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
      important: {
        path: params.path
      },
      results: {
        error: `Error writing file: ${error instanceof Error ? error.message : String(error)}`,
        showWhenDetailOff: true // Show errors even in simple mode
      }
    };
    return errorOutput;
  }
}