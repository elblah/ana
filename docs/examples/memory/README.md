# Memory System Examples

This directory contains example memory JSON files that establish behavioral patterns for the AI.

## File Naming Convention

Auto-loaded files use numbered prefixes: `1_name.json`, `2_name.json`, etc.

Manual-only files use underscore prefix: `_name.json`

## Available Examples

### Task Foundation (1-5)
- `1_task_sacred.json` - Sacred task principle
- `2_task_professional_standards.json` - Professional behavior
- `3_task_testing_rigor.json` - Testing requirements
- `4_task_security_focus.json` - Security mindset
- `5_task_code_quality.json` - Code quality standards

### Special Purpose
- `_debug_session_reset.json` - Debug mode reset (for manual injection)
- `_focus_simplicity.json` - Simplicity focus (for manual injection)

## Usage

### Auto-load
Copy numbered files to `.aicoder/memory/` - they load automatically on startup in numerical order.

### Manual Injection
```
/memory inject _debug_session_reset
/memory inject _focus_simplicity
```

## JSON Format

Each file contains an array of message objects:
```json
[
  {"role": "user", "content": "Instruction"},
  {"role": "assistant", "content": "Agreement/understanding"}
]
```

These messages are injected into the conversation history before the current message, establishing behavioral context.