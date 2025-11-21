# Custom Tool Argument Formatters

This document describes the custom argument formatting system for tools in aicoder-mini.

## Overview

Each tool can have its own `formatArguments` function that converts tool arguments into a human-readable format. This replaces the default JSON formatting, making tool calls easier to understand at a glance.

## How It Works

1. Each tool definition can include an optional `formatArguments` function
2. When a tool is called, the system checks if the tool has a custom formatter
3. If a formatter exists, it's used to display the arguments
4. If no formatter exists, the system falls back to JSON formatting

## Tool-Specific Formatters

### run_shell_command

**Format:**
```
Command: <command>
Reason: <reason>
Timeout: <timeout>s
```

**Features:**
- Always shows the command
- Shows reason if provided
- Shows timeout only if not the default (30s)

**Example:**
```
Command: npm install
Reason: Installing project dependencies
Timeout: 120s
```

### read_file

**Format:**
```
Path: <path>
Offset: line <offset>
Limit: <limit> lines
```

**Features:**
- Always shows the path
- Shows offset only if not 0 (default)
- Shows limit only if not 2000 (default)

**Example:**
```
Path: src/index.ts
     Offset: line 100
     Limit: 50 lines
```

### write_file

**Format:**
```
Path: <path>
Content: <content preview>
```

**Features:**
- Shows the file path
- Truncates content to 100 chars if longer
- Shows total character count for truncated content

**Example:**
```
Path: output.txt
     Content: This is a test file content that might be quite long and should be truncated... (160 chars total)
```

### edit_file

**Format:**
```
Path: <path>
Old: <old string preview>
New: <new string preview>
```

**Features:**
- Shows the file path
- Truncates strings to 50 chars if longer
- Special messages for empty strings (insert/delete operations)

**Example:**
```
Path: src/app.ts
     Old: console.log("old")
     New: console.log("new")
```

### grep

**Format:**
```
Text: "<search text>"
Path: <path>
Max results: <number>
Context: <number> lines
```

**Features:**
- Always shows the search text in quotes
- Shows path only if not '.' (default)
- Shows max results only if not 2000 (default)
- Shows context only if not 2 (default)

**Example:**
```
Text: "async function"
     Path: src/
     Max results: 100
     Context: 3 lines
```

### list_directory

**Format:**
```
Path: <path>
```

**Features:**
- Shows the path (defaults to '.' if not provided)

**Example:**
```
Path: src/
```

## Adding a New Formatter

To add a formatter to a new tool, add the `formatArguments` function to the tool definition:

```typescript
export const TOOL_DEFINITION = {
  // ... other properties
  formatArguments: (args: ToolParams): string => {
    // Format the arguments as a human-readable string
    const parts = [];
    if (args.required_param) {
      parts.push(`Required: ${args.required_param}`);
    }
    if (args.optional_param !== undefined) {
      parts.push(`Optional: ${args.optional_param}`);
    }
    return parts.join('\n     ');
  },
};
```

## Best Practices

1. **Omit default values**: Don't show parameters that are at their default values
2. **Truncate long content**: Show previews for long strings with ellipsis
3. **Use clear labels**: Prefix each line with descriptive labels (Command:, Path:, etc.)
4. **Be consistent**: Use similar formatting patterns across tools
5. **Keep it readable**: Use indentation and line breaks for multi-line displays

## Implementation Details

The formatter system is implemented in:
- `src/core/tool-manager.ts`: Added `formatArguments` method to ToolManager class
- `src/core/aicoder.ts`: Updated to use custom formatters when displaying tool calls
- Individual tool files: Added `formatArguments` functions to tool definitions

The formatter receives the parsed arguments object and returns a formatted string. The system handles:
- JSON string parsing (from API responses)
- Fallback to JSON formatting if formatter fails
- Graceful error handling