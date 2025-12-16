# Auto-Council Context Reset Feature

## Overview

Auto-council now supports two context management strategies for iterative development:

### 1. **Context Reset (Default)** - Fresh Context Each Turn
- Resets conversation history completely
- Provides clean slate for each iteration
- Prevents accumulated bias and context pollution
- Lower token usage per turn
- More focused responses

### 2. **Context Preserve (Optional)** - Traditional Approach  
- Maintains full conversation history
- Uses existing compaction system
- Better for complex evolving requirements
- Preserves implementation details
- Higher token usage per turn

## Configuration

### Environment Variables
```bash
# Enable context reset (default)
export AUTO_COUNCIL_RESET_CONTEXT=1

# Disable context reset, preserve history
export AUTO_COUNCIL_RESET_CONTEXT=0
```

### Command Line Flags
```bash
# Use default context strategy
/council --auto implement auth system

# Force context reset (fresh slate)
/council --auto --reset-context implement auth system

# Force context preservation
/council --auto --no-reset implement auth system
```

## How It Works

### Context Reset Mode
1. **Council reviews** current implementation
2. **Auto-moderator** provides structured feedback with context
3. **System resets** context completely
4. **AI receives focused prompt**: "Task: X. Council feedback: Y"
5. **Implementation** responds to specific feedback only
6. **Loop repeats** with fresh context each turn

### Context Preserve Mode
1. **Council reviews** current implementation
2. **Auto-moderator** provides structured feedback
3. **System adds** feedback to existing conversation
4. **AI sees** full history + new feedback
5. **Implementation** considers all previous context
6. **Compaction** manages context when it gets too large

## When to Use Each

### Use Context Reset When:
- Simple, well-defined requirements
- Want focused, efficient iterations
- Concerned about context pollution
- Prefer lower token usage
- Task doesn't require complex evolution

### Use Context Preserve When:
- Requirements are complex or evolving
- Need to reference previous implementation details
- Want council to consider development history
- Task benefits from accumulated context
- Don't mind higher token usage

## Enhanced Auto-Moderator

The auto-moderator now provides structured feedback that works with both modes:

```
CURRENT IMPLEMENTATION STATUS:
- What has been implemented so far
- What's missing from requirements  
- Progress assessment

REQUIREMENTS COMPLIANCE CHECK:
✅ Completed features
❌ Missing or incomplete features

IMMEDIATE ACTIONS NEEDED:
1. [Most critical fix] - specific action required
2. [Second priority] - specific action required

OVERALL ASSESSMENT:
- Summary of current state
- What needs completion
```

This structure preserves context across iterations regardless of the context strategy chosen.

## Examples

### Simple Auth System (Context Reset)
```bash
/council --auto implement JWT authentication
```
- Turn 1: Basic JWT implementation
- Turn 2: Add password validation (fresh context, focused)
- Turn 3: Add refresh tokens (fresh context, focused)
- Turn 4: Add rate limiting (fresh context, focused)
- Turn 5: Implementation approved

### Complex API System (Context Preserve)
```bash  
/council --auto --no-reset build REST API with complex business logic
```
- Turn 1: Basic API structure
- Turn 2: Add business logic (sees previous structure)
- Turn 3: Refactor based on learnings (sees full evolution)
- Turn 4: Add advanced features (builds on all previous work)

## Configuration Display

The system shows current context strategy at startup:

```
Configuration:
  Auto-council uses context reset (fresh context each turn)
```

Or:

```
Configuration:
  Auto-council preserves context (traditional approach)  
```

## Benefits

### Context Reset Benefits:
- ✅ Prevents conversation bias
- ✅ Lower cost per iteration
- ✅ Faster, more focused responses
- ✅ Clean implementation slate each turn
- ✅ Better for well-defined tasks

### Context Preserve Benefits:
- ✅ Maintains development context
- ✅ Builds on previous learnings
- ✅ Better for evolving requirements
- ✅ Preserves implementation details
- ✅ More natural conversation flow

Choose the strategy that best fits your development needs!