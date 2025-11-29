# Type System Organization

This directory contains type definitions organized by logical domain boundaries. The goal is to maintain a clean, scalable type system that supports the AI Coder application while keeping related concepts together.

## Domain Structure

### `message-types.ts` - Core Domain Entities
**Purpose:** Defines the fundamental message and conversation types that form the core domain model.

**Contains:**
- `Message` - Primary message interface with roles (system, user, assistant, tool)
- `MessageToolCall` - Tool call specifications within messages
- `AssistantMessage` - Assistant-specific message structure
- `ToolResultData` - Tool execution output format

**When to add types here:** New types that directly relate to the core message/conversation domain.

---

### `api-types.ts` - External Communication
**Purpose:** Defines all types related to external API communication, including requests, responses, and streaming data.

**Contains:**
- `ApiUsage` - Token usage statistics
- `ApiRequestData` - API request structure
- `StreamChunkData`/`StreamChunk` - Streaming response formats
- `UnknownError` - API error handling

**When to add types here:** Types that represent external API contracts, network communication, or data exchange with external services.

---

### `tool-types.ts` - Tool System & CLI
**Purpose:** Combines tool execution system types with CLI interaction types, as both represent user-facing functionality.

**Contains:**
- Tool system: `ToolDefinition`, `ToolParameters`, `ToolExecutionArgs`, `ToolOutput`, `ToolPreview`
- CLI system: `ReadlineInterface`, `CompletionCallback`, `CommandResult`

**When to add types here:** Types related to tool execution, CLI interactions, or user input/output handling.

---

### `system-types.ts` - System Interfaces & Forward Declarations
**Purpose:** Contains system-level interfaces, plugin types, and forward declarations needed to break circular dependencies.

**Contains:**
- Forward declarations: `MessageHistory`, `StreamingClient`, `InputHandler`, `Stats`
- Plugin system: `Plugin`, `PluginContext`, `NotificationHooks`
- Council system: `CouncilMember`, `CouncilConfig`, `CouncilResult`
- Prompt building: `PromptContext`, `PromptOptions`
- Utilities: `ConfigValue`, `ValidationResult`, `ErrorWithMessage`

**When to add types here:** 
- New forward declarations to break circular dependencies
- Plugin system types
- System-level configuration types
- Cross-cutting concerns that don't fit other domains

---

## Import Patterns

### Barrel Export (`index.ts`)
Use the barrel export for importing multiple types from the type system:

```typescript
import { Message, ApiUsage, ToolDefinition } from './types/index.js';
```

### Direct Imports
Use direct imports when only one or two types from a specific domain:

```typescript
import { Message, AssistantMessage } from './types/message-types.js';
```

### Type-Only Imports
Always use type-only imports for type definitions:

```typescript
import type { Message } from './types/index.js';
```

## Guidelines for Adding New Types

1. **Identify the domain:** Determine which domain the new type belongs to.
2. **Check existing types:** Ensure a similar type doesn't already exist.
3. **Add to appropriate file:** Place the type in the correct domain file.
4. **Update barrel export:** Add the new type to `index.ts` if not using `export *`.
5. **Add tests:** Include type tests in the appropriate test file.
6. **Document:** Add JSDoc comments explaining the type's purpose.

## Handling Circular Dependencies

When encountering circular dependencies between types:

1. **Use forward declarations** in `system-types.ts`
2. **Document the reason** for the forward declaration
3. **Consider domain boundaries** - maybe types belong in different domains
4. **Test thoroughly** to ensure imports resolve correctly

## Testing

Each type file has corresponding tests in the `__tests__/` directory:

- `index.test.ts` - Barrel export functionality
- `message-types.test.ts` - Message domain types
- `api-types.test.ts` - API communication types
- `tool-types.test.ts` - Tool and CLI types
- `system-types.test.ts` - System interface types
- `integration.test.ts` - Cross-domain integration tests

Run tests with: `bun test src/core/types/__tests__/`

## Performance Considerations

- Barrel exports are resolved at build time, no runtime overhead
- TypeScript's tree-shaking ensures only used types are included
- Domain organization helps with IDE performance and developer navigation

## Future Considerations

If a domain file becomes too large (>200 lines), consider splitting it further while maintaining logical coherence. The goal is to keep related concepts together while avoiding monolithic files.