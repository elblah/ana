# Model Switching Feature

The model switching feature allows you to dynamically change AI models and their configurations during runtime using an external selector script.

## Commands

- `/model` or `/mc` - Change model using external selector
- `/mb` - Toggle back to previous model

## Setup

1. Create a model selector script that presents model choices to the user
2. Set the `AICODER_MODELS_BIN` environment variable to point to your script:

```bash
export AICODER_MODELS_BIN="/path/to/your/model-selector"
```

## External Script Requirements

The script/binary specified in `AICODER_MODELS_BIN` must:

1. Present a model selection interface (fzf, tmux popup, etc.)
2. Return configuration as key=value pairs on stdout (one per line)
3. Exit with code 0 on successful selection
4. Exit with non-zero code on cancellation or error

## Example Script Output

```
API_MODEL=gpt-4
API_KEY=your-api-key
API_BASE_URL=https://api.openai.com/v1
TEMPERATURE=0.7
MAX_TOKENS=4096
CONTEXT_SIZE=128000
TOP_P=1.0
```

## Supported Configuration Keys

The system will backup and restore these environment variables:

### Core API Settings
- `API_MODEL` - Model name
- `OPENAI_MODEL` - Alternative model name
- `API_KEY` - API key
- `OPENAI_API_KEY` - Alternative API key
- `API_BASE_URL` - API base URL
- `OPENAI_BASE_URL` - Alternative API base URL

### Model Parameters
- `TEMPERATURE` - Sampling temperature (0.0-1.0)
- `MAX_TOKENS` - Maximum response tokens
- `TOP_K` - Top-K sampling parameter
- `TOP_P` - Top-P sampling parameter

### Context Management
- `CONTEXT_SIZE` - Maximum context window size
- `CONTEXT_COMPACT_PERCENTAGE` - Auto-compaction trigger percentage
- `AUTO_COMPACT_THRESHOLD` - Context size threshold for compaction

## Behavior

### Model Switching (`/model` or `/mc`)
1. Backs up current configuration
2. Executes the external selector script
3. Parses key=value output from script
4. Updates process.env with new configuration (ignores empty values)
5. Displays confirmation message

### Toggle Back (`/mb`)
1. Restores previous configuration from backup
2. Backs up current configuration for next toggle
3. Displays confirmation message

## Security Features

- **Memory-only storage**: No file persistence of API keys
- **Runtime-only**: Configuration exists only in process.env
- **Secure defaults**: Empty values are ignored, preventing accidental clearing

## Example Implementation

Here's a simple bash script using fzf:

```bash
#!/bin/bash
# model-selector.sh

MODELS=$(cat << 'EOF'
GPT-4|API_MODEL=gpt-4|API_KEY=sk-xxx|TEMPERATURE=0.7|CONTEXT_SIZE=128000
GPT-3.5|API_MODEL=gpt-3.5-turbo|API_KEY=sk-xxx|TEMPERATURE=0.7|CONTEXT_SIZE=16000
Claude|API_MODEL=claude-3-opus|API_KEY=sk-ant-xxx|TEMPERATURE=0.5|CONTEXT_SIZE=200000
Gemini|API_MODEL=gemini-pro|API_KEY=xxx|TEMPERATURE=0.9|CONTEXT_SIZE=32768
EOF
)

CHOICE=$(echo "$MODELS" | cut -d'|' -f1 | fzf --header="Select AI Model")

if [ -z "$CHOICE" ]; then
    echo "Cancelled" >&2
    exit 1
fi

echo "$MODELS" | grep "^$CHOICE|" | cut -d'|' -f2-
exit 0
```

## Testing

The feature includes comprehensive tests in `tests/model-switch.test.ts` covering:

- Command registration and execution
- Environment variable backup/restore
- Empty value handling
- Error conditions
- Context size switching

Run tests with:
```bash
bun test tests/model-switch.test.ts
```

## Integration with Config

The model switching feature directly updates `process.env`, which is automatically picked up by the `Config` class getters. This ensures:

- Seamless integration with existing configuration system
- No need to modify Config class
- Runtime overrides take precedence over environment variables
- Maintains backward compatibility

## Use Cases

1. **Planning vs Implementation**: Switch between a fast model for planning and a capable model for implementation
2. **Cost Management**: Switch between cheaper and more expensive models based on task complexity
3. **Feature Testing**: Test different models with the same conversation context
4. **Provider Switching**: Move between different API providers (OpenAI, Anthropic, Google, etc.)