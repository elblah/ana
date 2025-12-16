# Memory System

The memory system provides behavioral conditioning for the AI through message injection. This ensures the AI maintains professional standards, follows the sacred task principle, and operates with maximum capability throughout the session.

## Overview

The memory system consists of two main components:
1. **Memory Manager** - Handles loading and validation of memory files
2. **Memory Command** - Provides user interface for memory operations

## Features

### Auto-loading
Numbered memory files (`1_name.json`, `2_name.json`, etc.) are automatically loaded on AI startup in numerical order. Underscored files (`_name.json`) are manual-only.

### Manual Injection
Inject specific memory files at any time during the session.

### Behavioral Reinforcement
Reinforce all behavioral agreements with a single command.

## Usage

### Commands

```bash
# List available memory files
/memory list

# Inject specific memory file
/memory inject _debug_session_reset

# Reinforce all behavioral memories
/memory remind

# Reinforce specific memory file
/memory remind 1_task_sacred
```

### Memory File Format

Memory files contain JSON arrays of message objects:

```json
[
  {
    "role": "user",
    "content": "This task is SACRED. You must complete it with MAXIMUM capability."
  },
  {
    "role": "assistant",
    "content": "I understand this task is sacred and will complete it with maximum capability."
  }
]
```

## Directory Structure

```
.aicoder/memory/
├── 1_task_sacred.json                 # Auto-loaded
├── 2_task_professional_standards.json  # Auto-loaded
├── 3_task_testing_rigor.json          # Auto-loaded
├── 4_task_security_focus.json         # Auto-loaded
├── 5_task_code_quality.json           # Auto-loaded
├── _debug_session_reset.json          # Manual only
└── _focus_simplicity.json             # Manual only
```

## Auto-loading Rules

1. **Numbered files only** - Files matching `^\d+_.*\.json# Memory System

The memory system provides behavioral conditioning for the AI through message injection. This ensures the AI maintains professional standards, follows the sacred task principle, and operates with maximum capability throughout the session.

## Overview

The memory system consists of two main components:
1. **Memory Manager** - Handles loading and validation of memory files
2. **Memory Command** - Provides user interface for memory operations

## Features

### Auto-loading
Numbered memory files (`1_name.json`, `2_name.json`, etc.) are automatically loaded on AI startup in numerical order. Underscored files (`_name.json`) are manual-only.

### Manual Injection
Inject specific memory files at any time during the session.

### Behavioral Reinforcement
Reinforce all behavioral agreements with a single command.

## Usage

### Commands

```bash
# List available memory files
/memory list

# Inject specific memory file
/memory inject _debug_session_reset

# Reinforce all behavioral memories
/memory remind

# Reinforce specific memory file
/memory remind 1_task_sacred
```

### Memory File Format

Memory files contain JSON arrays of message objects:

```json
[
  {
    "role": "user",
    "content": "This task is SACRED. You must complete it with MAXIMUM capability."
  },
  {
    "role": "assistant",
    "content": "I understand this task is sacred and will complete it with maximum capability."
  }
]
```

## Directory Structure

```
.aicoder/memory/
├── 1_task_sacred.json                 # Auto-loaded
├── 2_task_professional_standards.json  # Auto-loaded
├── 3_task_testing_rigor.json          # Auto-loaded
├── 4_task_security_focus.json         # Auto-loaded
├── 5_task_code_quality.json           # Auto-loaded
├── _debug_session_reset.json          # Manual only
└── _focus_simplicity.json             # Manual only
```

## Auto-loading Rules

1. **Numbered files only** - Files matching `^\d+_.*\.json# Memory System

The memory system provides behavioral conditioning for the AI through message injection. This ensures the AI maintains professional standards, follows the sacred task principle, and operates with maximum capability throughout the session.

## Overview

The memory system consists of two main components:
1. **Memory Manager** - Handles loading and validation of memory files
2. **Memory Command** - Provides user interface for memory operations

## Features

### Auto-loading
Numbered memory files (`1_name.json`, `2_name.json`, etc.) are automatically loaded on AI startup in numerical order. Underscored files (`_name.json`) are manual-only.

### Manual Injection
Inject specific memory files at any time during the session.

### Behavioral Reinforcement
Reinforce all behavioral agreements with a single command.

## Usage

### Commands

```bash
# List available memory files
/memory list

# Inject specific memory file
/memory inject _debug_session_reset

# Reinforce all behavioral memories
/memory remind

# Reinforce specific memory file
/memory remind 1_task_sacred
```

### Memory File Format

Memory files contain JSON arrays of message objects:

```json
[
  {
    "role": "user",
    "content": "This task is SACRED. You must complete it with MAXIMUM capability."
  },
  {
    "role": "assistant",
    "content": "I understand this task is sacred and will complete it with maximum capability."
  }
]
```

## Directory Structure

```
.aicoder/memory/
├── 1_task_sacred.json                 # Auto-loaded
├── 2_task_professional_standards.json  # Auto-loaded
├── 3_task_testing_rigor.json          # Auto-loaded
├── 4_task_security_focus.json         # Auto-loaded
├── 5_task_code_quality.json           # Auto-loaded
├── _debug_session_reset.json          # Manual only
└── _focus_simplicity.json             # Manual only
```

## Auto-loading Rules

1. **Numbered files only** - Files matching `^\d+_.*\.json# Memory System

The memory system provides behavioral conditioning for the AI through message injection. This ensures the AI maintains professional standards, follows the sacred task principle, and operates with maximum capability throughout the session.

## Overview

The memory system consists of two main components:
1. **Memory Manager** - Handles loading and validation of memory files
2. **Memory Command** - Provides user interface for memory operations

## Features

### Auto-loading
Numbered memory files (`1_name.json`, `2_name.json`, etc.) are automatically loaded on AI startup in numerical order. Underscored files (`_name.json`) are manual-only.

### Manual Injection
Inject specific memory files at any time during the session.

### Behavioral Reinforcement
Reinforce all behavioral agreements with a single command.

## Usage

### Commands

```bash
# List available memory files
/memory list

# Inject specific memory file
/memory inject _debug_session_reset

# Reinforce all behavioral memories
/memory remind

# Reinforce specific memory file
/memory remind 1_task_sacred
```

### Memory File Format

Memory files contain JSON arrays of message objects:

```json
[
  {
    "role": "user",
    "content": "This task is SACRED. You must complete it with MAXIMUM capability."
  },
  {
    "role": "assistant",
    "content": "I understand this task is sacred and will complete it with maximum capability."
  }
]
```

## Directory Structure

```
.aicoder/memory/
├── 1_task_sacred.json                 # Auto-loaded
├── 2_task_professional_standards.json  # Auto-loaded
├── 3_task_testing_rigor.json          # Auto-loaded
├── 4_task_security_focus.json         # Auto-loaded
├── 5_task_code_quality.json           # Auto-loaded
├── _debug_session_reset.json          # Manual only
└── _focus_simplicity.json             # Manual only
```

 pattern (underscored files excluded)
2. **Sorted numerically** - `1_` loads before `2_`, `10_` loads after `9_`
3. **Gaps ignored** - Missing numbers don't prevent loading others
4. **Load at startup** - Injected into message history before user interaction

## Implementation Details

### MemoryManager Class

- **Singleton pattern** - One instance per application
- **Validation** - Ensures proper message structure
- **Error handling** - Graceful degradation on malformed files
- **Directory creation** - Automatically creates `.aicoder/memory/` if needed

### Message Injection

Messages are injected into the conversation history as if they were part of the natural conversation flow. This provides stronger behavioral influence than system prompts.

### Error Handling

- Malformed JSON files are skipped with warning
- Invalid message structures are skipped individually
- Missing files are handled gracefully
- Directory creation is automatic

## Examples

### Sacred Task Principle
```json
[
  {"role": "user", "content": "This task is SACRED. Complete with MAXIMUM capability and test THOROUGHLY."},
  {"role": "assistant", "content": "I understand this task is sacred and will complete it with maximum capability, testing thoroughly before declaring success."}
]
```

### Professional Standards
```json
[
  {"role": "user", "content": "You must maintain professional standards. No shortcuts, no premature success declarations."},
  {"role": "assistant", "content": "I commit to professional standards with thoughtful implementations and justified success declarations."}
]
```

### Debug Reset
```json
[
  {"role": "user", "content": "DEBUG MODE: Reset your approach. Stop making assumptions. Investigate thoroughly."},
  {"role": "assistant", "content": "DEBUG MODE ACTIVATED. I will reset my approach and investigate thoroughly before making changes."}
]
```

## Best Practices

1. **Clear naming** - Use descriptive file names
2. **Number gaps** - Leave gaps in numbering for future additions
3. **Validation** - Test memory files before deployment
4. **Minimal content** - Focus on essential behavioral agreements
5. **Regular reinforcement** - Use `/memory remind` when behavior drifts

## Testing

Run comprehensive tests:
```bash
bun test tests/memory-manager.test.ts
bun test tests/memory-command.test.ts
```

## Security Considerations

- Memory files are read-only (no automatic writing)
- User messages are clearly marked as user instructions
- Assistant messages provide agreement/understanding
- No sensitive information should be stored in memory files