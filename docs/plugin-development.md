# Plugin Development Guide

AI Coder Mini uses a simple, clean plugin system. Just drop a plugin file in `~/.config/aicoder-mini/plugins/` and it works.

## Simple Plugin Format

Every plugin is just a JavaScript/TypeScript file with a default export:

```typescript
export default {
  name: 'my-plugin',
  description: 'What this plugin does',
  version: '1.0.0',
  
  // Optional: Commands users can run
  commands: {
    '/mycommand': (args: string[]) => {
      return 'Hello from my plugin!';
    }
  },
  
  // Optional: Hooks that run automatically
  hooks: {
    after_file_write: (path: string, content: string) => {
      console.log(`File written: ${path}`);
    }
  },
  
  // Optional: AI-callable tools
  tools: [{
    type: 'tool',
    description: 'My custom tool',
    parameters: { input: 'string' },
    execute: async (args: { input: string }) => {
      return `Processed: ${args.input}`;
    }
  }],
  
  // Optional: Lifecycle methods
  initialize: () => {
    console.log('Plugin initialized!');
  },
  
  cleanup: () => {
    console.log('Plugin cleaned up!');
  }
};
```

## Available Hooks

```typescript
hooks: {
  // Before file operations
  before_file_write?: (path: string, content: string) => string | void;
  after_file_write?: (path: string, content: string) => void;
  
  // Before/after tool calls
  before_tool_call?: (toolName: string, args: any) => boolean | void;
  after_tool_call?: (toolName: string, result: any) => any;
}
```

## Complete Example

```typescript
/**
 * Python Linter Plugin
 * Drop this file in ~/.config/aicoder-mini/plugins/python-linter.js
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';

export default {
  name: 'python-linter',
  description: 'Python linting and formatting',
  version: '1.0.0',

  // User commands
  commands: {
    '/lint': (args: string[]) => {
      const file = args[0];
      if (!file) return 'Usage: /lint <python-file>';
      
      if (!file.endsWith('.py')) {
        return 'Error: Can only lint Python files';
      }
      
      try {
        // Check Python syntax
        require('module')._compile(fs.readFileSync(file, 'utf8'), file);
        return '✓ Python syntax OK';
      } catch (error: any) {
        return `✗ Syntax error: ${error.message}`;
      }
    }
  },

  // Automatic hooks
  hooks: {
    after_file_write: (path: string, content: string) => {
      // Auto-lint Python files after save
      if (path.endsWith('.py')) {
        try {
          require('module')._compile(content, path);
          console.log(`[python-linter] ✓ ${path}`);
        } catch (error: any) {
          console.log(`[python-linter] ✗ ${path}: ${error.message}`);
        }
      }
    },

    before_tool_call: (toolName: string, args: any) => {
      // Prevent writing broken Python files
      if (toolName === 'write_file' && args.path?.endsWith('.py')) {
        try {
          require('module')._compile(args.content, args.path);
        } catch (error: any) {
          console.log(`[python-linter] Blocked: Python syntax error`);
          return false; // Cancel the tool call
        }
      }
    }
  },

  // AI-callable tools
  tools: [{
    type: 'tool',
    description: 'Check Python syntax',
    parameters: { file: 'string' },
    execute: async (args: { file: string }) => {
      try {
        fs.readFileSync(args.file, 'utf8');
        return 'Python syntax OK';
      } catch (error: any) {
        return `Syntax error: ${error.message}`;
      }
    }
  }],

  // Lifecycle
  initialize: () => {
    console.log('[python-linter] Ready to lint Python files');
  }
};
```

## Installation

1. **Save your plugin** as a `.js` or `.ts` file
2. **Drop it in** `~/.config/aicoder-mini/plugins/`
3. **Restart AI Coder** or reload plugins
4. **Your commands and hooks are now active!**

## Best Practices

- **Use descriptive names** - `python-linter` not `pl1`
- **Handle errors gracefully** - try/catch, don't crash
- **Log with plugin prefix** - `[my-plugin] message`
- **Keep plugins focused** - one job, done well
- **Test thoroughly** - ensure hooks don't break workflows

## Tips

- **TypeScript is optional** - plain JavaScript works fine
- **No complex setup** - just export the object
- **Auto-discovery** - no registration needed
- **Hot reloadable** - restart to pick up changes
- **Environment access** - use `process.env` for config

That's it! Simple, clean, drag-and-drop plugins.