# Feature Specification: Inject Memory via Tmux Popup Menu

## Overview
Add "Inject memory" functionality to the tmux popup menu that allows users to compose and inject custom memory content as user messages into the conversation history.

## Requirements

### Core Functionality
1. **Menu Item**: Add "Inject memory" to tmux popup menu with key 'i'
2. **Editor Integration**: Open `$EDITOR` in a new tmux window (like `/edit` command)
3. **Empty Initial Content**: Start with empty file (not instructions or examples)
4. **Change Detection**: Only inject content if the file was actually modified
5. **Content Display**: Show injected content in console like `/edit` command does
6. **Integration**: Must be integrated into core system (not plugin-based)

### Message History Positioning
**CRITICAL**: User messages cannot be inserted arbitrarily in message history. Must determine correct insertion point by scanning backwards from end:

- **Rule 1**: Insert after the **last user message**
- **Rule 2**: Insert after the **last tool result** 
- **Final Rule**: Insert after whichever comes **first** (later in history)
- **Edge Cases**: 
  - Empty history: Insert at position 0
  - Only system messages: Insert after system messages
  - No user messages or tool results: Insert at end

### User Experience
- Confirmation message when injection succeeds
- Show injected content with visual separators
- Handle empty content gracefully (cancel injection)
- Proper error handling for editor/file issues
- Only works in tmux environment (like `/edit`)

## Technical Implementation

### Files to Modify
1. **`src/core/input-handler.ts`**:
   - Add "Inject memory" item to base menu items array
   - Add 'i' case to `processMenuSelection()` method
   - Implement `handleInjectMemory()` method

2. **`src/core/message-history.ts`**:
   - Add helper method: `insertUserMessageAfterLastAppropriatePosition(content: string)`
   - Implement backward scanning logic for insertion point
   - Handle all edge cases for positioning

### Key Integration Points

#### Editor Pattern (follow `/edit` command exactly):
```typescript
// Use same pattern as EditCommand:
const editor = process.env.EDITOR || 'nano';
const randomSuffix = randomBytes(4).toString('hex');
const tempFile = TempFileUtils.createTempFile(`aicoder-inject-${randomSuffix}`, '.md');
// Empty initial content: writeFileSync(tempFile, '', 'utf8')
// Same tmux new-window pattern with sync points
// Same change detection: compare content.trim()
```

#### Message Insertion Algorithm:
```typescript
// Pseudocode for insertion logic:
function findInsertionIndex(messages: Message[]): number {
    let lastUserIndex = -1;
    let lastToolIndex = -1;
    
    // Scan backwards
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'user' && lastUserIndex === -1) {
            lastUserIndex = i;
        }
        if (msg.role === 'tool' && lastToolIndex === -1) {
            lastToolIndex = i;
        }
        // Break when both found
        if (lastUserIndex !== -1 && lastToolIndex !== -1) break;
    }
    
    // Return the later position (higher index)
    const insertAfter = Math.max(lastUserIndex, lastToolIndex);
    return insertAfter + 1; // Insert after the found position
}
```

### Dependencies and Imports
- Uses existing: `TempFileUtils`, `Config`, `LogUtils`
- Uses existing patterns from `EditCommand`
- Uses existing `MessageHistory` methods
- No new external dependencies required

### Error Handling
1. **Non-tmux Environment**: Show error like `/edit` command
2. **Editor Failures**: Catch and display user-friendly errors
3. **File Operations**: Proper cleanup of temporary files
4. **Empty Content**: Graceful cancellation with user feedback
5. **Message History**: Handle edge cases safely

### Testing Considerations
- Test insertion positioning with various message histories
- Test empty file handling
- Test editor cancellation scenarios  
- Test tmux vs non-tmux environments
- Verify cleanup of temporary files

## Success Criteria
1. Menu item appears and works with 'i' key
2. Editor opens in new tmux window correctly
3. Content is injected at proper position in message history
4. User sees confirmation and injected content
5. No memory leaks (temp files cleaned up)
6. Works consistently with `/edit` command pattern
7. Handles all edge cases gracefully

## Constraints
- **KISS Principle**: Simplest solution that works reliably
- **No External Dependencies**: Use existing utilities and patterns
- **Type Safety**: Proper TypeScript types throughout
- **Performance**: Efficient message scanning (linear backward scan)
- **Consistency**: Follow existing codebase patterns exactly