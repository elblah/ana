# AI Coder Mini

Fast, lightweight AI-assisted development that runs anywhere.

AI Coder Mini is a TypeScript-based CLI tool that provides AI-powered coding assistance with a focus on simplicity, security, and performance. Built on Bun.js for maximum speed and minimal dependencies.

## Features

- **Lightweight & Fast**: Built with Bun.js for optimal performance
- **No External Dependencies**: Self-contained with minimal runtime requirements  
- **AI-Powered Assistance**: Stream-based AI responses with tool execution
- **File Operations**: Read, write, edit, search files and directories
- **Command System**: Extensible command architecture with built-in commands
- **Plugin System**: Modular plugin architecture for extensibility
- **Memory Management**: Intelligent conversation history with compaction
- **Statistics Tracking**: Real-time usage statistics and metrics
- **Sandbox Support**: Safe execution in restricted environments
- **Raspberry Pi Compatible**: Designed to run on resource-constrained devices

## Quick Start

### Prerequisites

- [Bun.js](https://bun.sh/) runtime
- Node.js 20+ (for TypeScript types)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/aicoder-mini.git
cd aicoder-mini

# Run the installation script
./install.sh
```

The installer automatically detects your environment:
- Standard installation to `~/.local/share/aicoder-mini`
- Sandbox mode for restricted environments (firejail, read-only filesystems)

### Manual Installation

```bash
# Install dependencies
bun install

# Build the project
bun run build

# Run directly
bun src/index.ts

# Or use the built version
bun dist/index.js
```

## Usage

### Basic Commands

```
aicoder-mini                    # Start interactive mode
aicoder-mini --help            # Show help
aicoder-mini --version         # Show version
```

### Interactive Commands

Once in interactive mode, you can use these commands:

- `/help` - Show available commands
- `/clear` - Clear conversation history  
- `/save <name>` - Save current conversation
- `/load <name>` - Load a saved conversation
- `/stats` - Show usage statistics
- `/memory` - Show memory usage
- `/compact` - Compact conversation history
- `/detail` - Toggle detailed mode
- `/yolo` - Toggle auto-approval mode
- `/reset` - Reset conversation
- `/quit` - Exit the application

### AI Assistance

Simply type your coding questions or requests:

```
How do I implement a binary search tree?
Create a REST API endpoint for user management
Refactor this function to be more readable
```

### File Operations

AI Coder Mini can perform file operations through AI assistance:

```
Read the package.json file
Create a new utils.ts file with helper functions
Search for all TypeScript files containing "interface"
```

## Architecture

### Core Components

- **AICoder**: Main application controller
- **StreamingClient**: Handles AI communication and streaming responses
- **ToolManager**: Manages available tools and their execution
- **CommandHandler**: Processes user commands
- **MessageHistory**: Manages conversation context and memory
- **PluginSystem**: Extensible plugin architecture
- **InputHandler**: Processes user input with interrupt handling

### Built-in Tools

- `read-file` - Read file contents
- `write-file` - Write or create files
- `edit-file` - Edit existing files
- `list-directory` - List directory contents
- `run-shell-command` - Execute shell commands
- `grep` - Search text in files

### Plugin System

Extend functionality with plugins:

```typescript
// Example plugin structure
export class MyPlugin implements Plugin {
  name = "my-plugin";
  version = "1.0.0";
  
  async initialize(context: PluginContext) {
    // Plugin initialization
  }
  
  async destroy() {
    // Cleanup
  }
}
```

## Development

### Project Structure

```
src/
├── core/                  # Core application logic
│   ├── aicoder.ts        # Main application class
│   ├── commands/         # Command implementations
│   ├── plugin-system.ts  # Plugin management
│   └── ...               # Other core modules
├── prompts/              # AI prompt templates
├── tools/               # Built-in tool implementations
└── index.ts            # Application entry point

tests/                  # Test suite
plugins/               # Example plugins
docs/                  # Documentation
```

### Building

```bash
# Standard build
bun run build

# Minified build
MINIFIED=1 bun run build
# or
bun run build:min
```

### Testing

```bash
# Run all tests
bun test

# Run tests with coverage
bun test --coverage
```

### Code Style

This project follows strict coding guidelines:

- **Readability is mandatory** - Keep code simple and clear
- **Guard clauses over else** - Use early returns/exceptions
- **Test every feature** - Comprehensive test coverage
- **No emojis in code** - Use unicode symbols (✓, ✗) instead
- **TypeScript strict mode** - Full type safety

## Configuration

AI Coder Mini can be configured through environment variables and configuration files.

### Environment Variables

```bash
# AI provider configuration
AI_PROVIDER="openai"          # openai, anthropic, etc.
AI_API_KEY="your-api-key"
AI_MODEL="gpt-4"

# Behavior configuration
MAX_TOKENS=4096               # Maximum context size
TEMPERATURE=0.7               # AI response randomness
AUTO_APPROVE=false            # Auto-approve tool executions

# Plugin configuration
DISABLE_PLUGINS=1             # Disable all plugins from loading
```

## Security

- **Sandbox Mode**: Safe execution in restricted environments
- **No External Dependencies**: Reduced attack surface
- **Permission Controls**: Explicit file access controls
- **Command Validation**: All tool calls validated before execution

## Performance

- **Lightweight Runtime**: Minimal memory footprint (<50MB base)
- **Efficient Streaming**: Real-time AI responses without buffering
- **Smart Caching**: Intelligent response caching
- **Optimized for RPi3**: Runs efficiently on resource-constrained devices

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes following the code style guidelines
4. Add tests for new functionality
5. Run the test suite: `bun test`
6. Submit a pull request

### Development Guidelines

- Read existing code before making changes
- Ask for clarification when requirements are unclear
- Create tests for every new feature
- Use guard clauses instead of else statements
- Keep code readable and maintainable
- Consider performance on resource-constrained devices

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

## Support

- **Issues**: Report bugs and request features via GitHub Issues
- **Documentation**: Check the `docs/` directory for detailed guides
- **Community**: Join discussions in GitHub Discussions

## Acknowledgments

Built with:
- [Bun.js](https://bun.sh/) - Fast JavaScript runtime
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- The open-source community!

---

**AI Coder Mini** - Fast, lightweight AI-assisted development that runs anywhere.
