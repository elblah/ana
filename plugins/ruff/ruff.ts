import type { PluginContext } from '../../src/core/plugin-system.js';

// Plugin configuration
const ENABLE_RUFF_FORMAT = process.env.RUFF_FORMAT === '1' || process.env.RUFF_FORMAT === 'true';

// Ruff plugin implementation
export default function createRuffPlugin(ctx: PluginContext) {
  let enabled = true;
  let formatEnabled = ENABLE_RUFF_FORMAT;

  async function runRuff(path: string): Promise<string> {
    try {
      const { spawn } = await import('node:child_process');

      const result = await new Promise<string>((resolve, reject) => {
        const process = spawn('ruff', ['check', path], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        process.stdout.on('data', (data) => {
          output += data.toString();
        });

        process.stderr.on('data', (data) => {
          output += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve('[*] Ruff: No issues found');
          } else {
            resolve(`[x] Ruff issues found:\n${output}`);
          }
        });

        process.on('error', reject);
      });

      return result;
    } catch (error) {
      if (`${error}`.includes('ENOENT')) {
        return '[!] Ruff not installed. Install with: pip install ruff';
      }
      return `[x] Ruff error: ${error}`;
    }
  }

  async function runRuffFormat(path: string): Promise<string> {
    try {
      const { spawn } = await import('node:child_process');

      const result = await new Promise<string>((resolve, reject) => {
        const process = spawn('ruff', ['format', path], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';
        process.stdout.on('data', (data) => {
          output += data.toString();
        });

        process.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve('[*] Ruff: Formatted successfully');
          } else {
            resolve(`[x] Ruff format failed:\n${errorOutput}`);
          }
        });

        process.on('error', reject);
      });

      return result;
    } catch (error) {
      return `[x] Ruff format error: ${error}`;
    }
  }

  function isPythonFile(path: string): boolean {
    return path.endsWith('.py');
  }

  // Hook into file operations using afterToolCall
  ctx.config.afterToolCall = (toolName: string, result: string): string | void => {
    if (toolName === 'write_file' && result.includes('Successfully wrote') && result.includes('.py')) {
      const pathMatch = result.match(/to (.+)$/);
      if (pathMatch) {
        const filePath = pathMatch[1];
        if (isPythonFile(filePath)) {
          // Run ruff check asynchronously
          runRuff(filePath).then(ruffResult => {
            if (ruffResult.includes('issues found')) {
              ctx.addUserMessage(`Ruff Plugin: Issues Detected in ${filePath}

The Ruff plugin automatically detected code quality issues in the file you just saved and is asking the AI to fix them:

\`\`\`
${ruffResult}
\`\`\`

Plugin Action: The AI will now attempt to fix these issues automatically.
File: ${filePath}
Tool: Use edit_file or write_file to resolve the problems

The file has already been saved, so the AI needs to edit it again to resolve the issues.`);
            } else if (formatEnabled) {
              // Run formatting if no issues and formatting is enabled
              runRuffFormat(filePath).then(fmtResult => {
                if (fmtResult && !fmtResult.includes('failed')) {
                  ctx.addUserMessage(`[*] Ruff Plugin: File Formatted

The Ruff plugin automatically formatted the file to improve code style and consistency:

File: ${filePath}
Plugin Action: File was reformatted using ruff format
Status: Formatting completed successfully

The file content has been updated to follow Python formatting standards.`);
                }
              });
            }
          });
        }
      }
    }
    return undefined; // Don't modify the original result
  };

  // Command handler for configuration
  function handleRuffCommand(args: string[]): boolean | void {
    if (!args.length) {
      const status = `Ruff Plugin Status

- **Checking**: [${enabled ? '✓' : 'X'}] ${enabled ? 'Enabled' : 'Disabled'}
- **Auto-format**: [${formatEnabled ? '✓' : 'X'}] ${formatEnabled ? 'Enabled' : 'Disabled'}

**Commands:**
- \`/ruff check on/off\` - Enable/disable checking
- \`/ruff format on/off\` - Enable/disable auto-formatting
- \`/ruff help\` - Show this help`;
      
      console.log(status);
      return;
    }

    const cmd = args[0].toLowerCase();

    switch (cmd) {
      case 'check':
        if (args.length >= 2 && ['on', 'off'].includes(args[1].toLowerCase())) {
          enabled = args[1].toLowerCase() === 'on';
          ctx.setConfig('ruff.enabled', enabled);
          console.log(`[✓] Ruff checking turned ${enabled ? 'on' : 'off'}`);
        } else {
          console.log('[X] Usage: `/ruff check on|off`');
        }
        break;

      case 'format':
        if (args.length >= 2 && ['on', 'off'].includes(args[1].toLowerCase())) {
          formatEnabled = args[1].toLowerCase() === 'on';
          ctx.setConfig('ruff.format_enabled', formatEnabled);
          console.log(`[✓] Ruff auto-formatting turned ${formatEnabled ? 'on' : 'off'}`);
        } else {
          console.log('[X] Usage: `/ruff format on|off`');
        }
        break;

      case 'help':
        const helpText = `Ruff Plugin Commands

- \`/ruff\` - Show current status
- \`/ruff check on|off\` - Enable/disable checking
- \`/ruff format on|off\` - Enable/disable auto-formatting
- \`/ruff help\` - Show this help

**Tools Used:**
- \`ruff check\` - Python code quality checks
- \`ruff format\` - Python code formatter

**Environment Variables:**
- RUFF_FORMAT: true/false/on/off/1/0 - Enable auto-formatting`;
        console.log(helpText);
        break;

      default:
        console.log(`[X] Unknown ruff command: ${cmd}. Use \`/ruff help\` for available commands.`);
    }
  }

  // Register command so it appears in help
  ctx.registerCommand('/ruff', handleRuffCommand, 'Configure ruff Python linting and formatting');

  // Load config from persistent storage if available
  enabled = ctx.getConfig('ruff.enabled') ?? enabled;
  formatEnabled = ctx.getConfig('ruff.format_enabled') ?? formatEnabled;

  return {
    name: 'Ruff Plugin',
    version: '1.0.0',
    description: 'Automatic Python code quality checks with ruff'
  };
}