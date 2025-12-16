# AI Workflow Guide

This document outlines the recommended workflow for working with AI assistants on this project, balancing productivity with safety and clean version control practices.

## Overview

The AI workflow is designed to:
- Enable AI productivity while maintaining code quality
- Provide clear boundaries and checkpoints
- Maintain clean, understandable git history
- Allow safe experimentation without risking the main codebase

## Core Principles

1. **AI works in isolation** - Feature branches, not master
2. **Human review is mandatory** - All changes reviewed before merge
3. **Clean history** - Semantic commits and descriptive branches
4. **Reversible changes** - Easy rollback if AI makes mistakes
5. **Clear intent** - Branch and commit names describe purpose

## Branch Naming Convention

Use semantic prefixes for clarity:

- `feature/` - New functionality additions
- `fix/` - Bug fixes and error corrections
- `refactor/` - Code improvements without functionality changes
- `test/` - Test additions and improvements
- `docs/` - Documentation updates
- `chore/` - Maintenance and build-related changes

### Examples:
```
feature/memory-system
fix/council-decision-parsing
refactor/streaming-client
test/sandbox-security
docs/api-documentation
chore/update-dependencies
```

## Recommended Workflow

### 1. Create Feature Branch
```bash
# Always work on branches, never on master
git checkout -b feature/memory-system
```

### 2. AI Work Phase
- AI implements the feature/fix/refactor
- Creates comprehensive tests
- Updates documentation as needed
- Commits frequently with descriptive messages

### 3. Review and Merge
```bash
# Switch to master
git checkout master

# Review changes (human review)
git diff feature/memory-system

# Merge if approved
git merge feature/memory-system

# Clean up
git branch -d feature/memory-system
```

## AI-Specific Guidelines

### When AI Creates a Branch
The AI should:
1. Use appropriate prefix from naming convention
2. Make branch names descriptive and concise
3. Focus on single feature/fix per branch
4. Create comprehensive tests for changes

### Commit Message Format
```
type(scope): description

- Add memory-manager.ts for persistent context
- Implement council auto-exclusion logic
- Add comprehensive test coverage

Related to: #issue-number
```

### Branch Lifecycle
1. **Creation**: AI creates branch with clear purpose
2. **Development**: AI works within branch boundaries
3. **Testing**: AI ensures all tests pass
4. **Review**: Human reviews changes
5. **Merge**: Human merges if approved
6. **Cleanup**: Delete feature branch

## Multiple AI Considerations

If working with multiple AI instances:

### Separate Workspaces
```bash
# AI 1 on memory system
git checkout -b feature/memory-system

# AI 2 on council improvements
git checkout -b feature/council-consensus
```

### Coordination Rules
- Each AI works on separate branches
- No direct collaboration on same branch
- Human merges branches in logical order
- Resolve conflicts during merge phase

## Safety Boundaries

### AI Should NOT:
- Work directly on master branch
- Push to remote repositories
- Delete branches without approval
- Force push or rewrite history
- Merge branches without human review

### Human Must:
- Review all code before merge
- Test changes in local environment
- Verify tests pass
- Check for security implications
- Approve branch deletion

## Example Session

### AI Workflow:
```bash
# 1. Start new feature
git checkout -b feature/auto-retry-mechanism

# 2. Implement changes
# ... AI writes code ...

# 3. Commit with clear message
git add .
git commit -m "feat(retry): add exponential backoff mechanism

- Implement exponential backoff for failed requests
- Add configurable retry limits and delays
- Include comprehensive test coverage
- Update documentation with retry behavior"

# 4. Continue work as needed
# ... more commits ...

# 5. Signal completion to human
echo "Feature complete and ready for review"
```

### Human Review:
```bash
# Switch to master
git checkout master

# Review the changes
git diff feature/auto-retry-mechanism

# Run tests
bun test

# If approved, merge
git merge feature/auto-retry-mechanism
git branch -d feature/auto-retry-mechanism

# Push to bridge repository
git push bridge master
```

## Troubleshooting

### Branch Conflicts
```bash
# During merge, resolve conflicts manually
git merge feature/branch-name
# Resolve conflicts in files
git add .
git commit -m "resolve: merge conflicts in feature/branch-name"
```

### Accidental Master Work
If AI accidentally works on master:
```bash
# Create branch from current state
git checkout -b fix/accidental-master-work
git reset --hard HEAD~1  # Reset master
# Continue work on branch
```

### Recovery from AI Mistakes
```bash
# If branch is problematic
git checkout master
git branch -D feature/problematic-branch

# Or revert merge
git revert -m 1 HEAD
```

## Best Practices

### For AI:
- Keep branches focused on single changes
- Write descriptive commit messages
- Create tests for all new functionality
- Document complex changes
- Signal when work is ready for review

### For Humans:
- Review changes carefully
- Test in local environment
- Verify documentation is accurate
- Check for security implications
- Maintain clean git history

## Integration with Security Model

This workflow integrates seamlessly with the 3-layer security model:
1. **Sandbox Layer** - AI works in isolated branches
2. **Bridge Layer** - Human decides what to merge and push
3. **Gateway Layer** - Final review before GitHub publication

The branching adds an additional layer of control within the sandbox, making AI work more predictable and manageable.

## Conclusion

This workflow provides:
- ✅ Safety through isolation
- ✅ Clarity through semantic naming
- ✅ Quality through mandatory review
- ✅ Flexibility through reversible changes
- ✅ Collaboration through structured process

By following these guidelines, you can maximize AI productivity while maintaining code quality and security.