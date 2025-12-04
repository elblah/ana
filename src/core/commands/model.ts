import { BaseCommand, type CommandResult, CommandContext } from './base.js';
import { Config } from '../config.js';
import { LogUtils } from '../../utils/log-utils.js';

// Global list of all model-related variables that need to be reset when switching models
const MODEL_VARIABLES = [
    'API_MODEL', 'OPENAI_MODEL', 
    'API_KEY', 'OPENAI_API_KEY', 
    'API_BASE_URL', 'OPENAI_BASE_URL', 
    'TEMPERATURE', 'MAX_TOKENS', 'TOP_K', 'TOP_P', 
    'CONTEXT_SIZE',
    // Additional model-specific parameters that could cause state pollution
    'FREQUENCY_PENALTY', 'PRESENCE_PENALTY', 'STOP_SEQUENCES',
    'SEED', 'MODEL_TYPE', 'PROVIDER', 'REGION', 'DEPLOYMENT_ID'
];

export class ModelCommand extends BaseCommand {
    protected name = 'model';
    protected description = 'Switch AI model using external selector';
    
    // Simple in-memory storage - no files, no persistence
    private static previousConfig: { [key: string]: string } = {};

    getAliases(): string[] {
        return ['mc']; // model change
    }

    async execute(args: string[]): Promise<CommandResult> {
        // Check if user wants help
        if (args.length > 0) {
            if (args[0] === 'help') {
                this.showDetailedHelp();
                return { shouldQuit: false, runApiCall: false };
            }
            
            if (args[0] === 'info') {
                this.showModelInfo();
                return { shouldQuit: false, runApiCall: false };
            }
        }

        const binPath = process.env.AICODER_MODELS_BIN;
        
        if (!binPath) {
            this.showHelp();
            return { shouldQuit: false, runApiCall: false };
        }

        try {
            // Execute the external binary
            const result = await this.executeBinary(binPath);
            
            if (result.exitCode !== 0) {
                console.log(`${Config.colors.yellow}Model selection cancelled or failed${Config.colors.reset}`);
                return { shouldQuit: false, runApiCall: false };
            }

            // Parse key=value output
            const newConfig = this.parseConfigOutput(result.stdout);
            
            if (Object.keys(newConfig).length === 0) {
                console.log(`${Config.colors.yellow}No model configuration received${Config.colors.reset}`);
                return { shouldQuit: false, runApiCall: false };
            }

            // Take atomic snapshot of current environment for backup
            const currentEnvSnapshot: { [key: string]: string } = {};
            MODEL_VARIABLES.forEach(key => {
                if (process.env[key]) {
                    currentEnvSnapshot[key] = process.env[key]!;
                }
            });

            // Reset ALL model variables first to clean previous model state
            MODEL_VARIABLES.forEach(key => {
                delete process.env[key];
            });

            // Update process.env with new values (only if value is not empty)
            Object.entries(newConfig).forEach(([key, value]) => {
                if (value && value.trim() !== '') {
                    process.env[key] = value;
                }
            });

            // Store previous config atomically AFTER the switch is complete
            ModelCommand.previousConfig = currentEnvSnapshot;

            // Show what changed
            const modelName = newConfig.API_MODEL || newConfig.OPENAI_MODEL || 'unknown';
            console.log(`${Config.colors.green}✓ Switched to model: ${modelName}${Config.colors.reset}`);

            return { shouldQuit: false, runApiCall: false };
            
        } catch (error) {
            console.log(`${Config.colors.red}Error: ${error instanceof Error ? error.message : 'Unknown error'}${Config.colors.reset}`);
            return { shouldQuit: false, runApiCall: false };
        }
    }

    private async executeBinary(binPath: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
        const { spawn } = await import('child_process');
        
        return new Promise((resolve) => {
            const child = spawn(binPath, [], {
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 30000 // 30 second timeout
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                resolve({
                    exitCode: code || 0,
                    stdout: stdout.trim(),
                    stderr: stderr.trim()
                });
            });

            child.on('error', (error) => {
                resolve({
                    exitCode: 1,
                    stdout: '',
                    stderr: error.message
                });
            });
        });
    }

    private parseConfigOutput(output: string): { [key: string]: string } {
        const config: { [key: string]: string } = {};
        
        output.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && trimmed.includes('=')) {
                const [key, ...valueParts] = trimmed.split('=');
                const value = valueParts.join('=').trim();
                if (key) {
                    config[key] = value;
                }
            }
        });

        return config;
    }

    private showHelp(): void {
        const help = `
${Config.colors.yellow}Model Switch Configuration${Config.colors.reset}

To use model switching, set the AICODER_MODELS_BIN environment variable:

${Config.colors.green}export AICODER_MODELS_BIN="/path/to/your/model-selector"${Config.colors.reset}

This should be a script or binary that:
- Presents a model selection interface (fzf, etc.)
- Returns key=value pairs on stdout (one per line)
- Exits with code 0 on success, non-zero on cancellation

${Config.colors.cyan}Example output:${Config.colors.reset}
API_MODEL=gpt-4
API_KEY=your-key-here
TEMPERATURE=0.7

${Config.colors.cyan}Commands:${Config.colors.reset}
  ${Config.colors.green}/model${Config.colors.reset} or ${Config.colors.green}/mc${Config.colors.reset} - Change model
  ${Config.colors.green}/model help${Config.colors.reset} - Show detailed help and current configuration
  ${Config.colors.green}/model info${Config.colors.reset} - Show current and previous model information
  ${Config.colors.green}/mb${Config.colors.reset} - Toggle back to previous model

${Config.colors.cyan}Note:${Config.colors.reset} 
When switching models, all model-specific configuration variables are reset to prevent 
state pollution between different model types and configurations.
`;
        LogUtils.print(help);
    }

    private showDetailedHelp(): void {
        // Create a temporary snapshot of current environment for tests
        const originalEnv = { ...process.env };
        
        // Get current model configuration
        const currentConfig: { [key: string]: string } = {};
        MODEL_VARIABLES.forEach(key => {
            if (process.env[key]) {
                currentConfig[key] = process.env[key]!;
            }
        });

        // Format current configuration
        const currentConfigLines = Object.keys(currentConfig).length > 0
            ? Object.entries(currentConfig)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => `  ${Config.colors.cyan}${key}${Config.colors.reset} = ${Config.colors.green}${value}${Config.colors.reset}`)
                .join('\n')
            : `  ${Config.colors.yellow}No model configuration currently set${Config.colors.reset}`;

        // Format previous configuration
        const previousConfigLines = Object.keys(ModelCommand.previousConfig).length > 0
            ? Object.entries(ModelCommand.previousConfig)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => `  ${Config.colors.cyan}${key}${Config.colors.reset} = ${Config.colors.green}${value}${Config.colors.reset}`)
                .join('\n')
            : `  ${Config.colors.yellow}No previous model configuration available${Config.colors.reset}`;

        // Format available variables
        const variableLines = MODEL_VARIABLES
            .map(key => `  ${Config.colors.cyan}${key}${Config.colors.reset}`)
            .join('\n');

        const detailedHelp = `
${Config.colors.bold}${Config.colors.yellow}Model Command Detailed Help${Config.colors.reset}

${Config.colors.cyan}Available Model Variables:${Config.colors.reset}
${variableLines}

${Config.colors.cyan}Current Model Configuration:${Config.colors.reset}
${currentConfigLines}

${Config.colors.cyan}Previous Model Configuration:${Config.colors.reset}
${previousConfigLines}

${Config.colors.cyan}Available Commands:${Config.colors.reset}
  ${Config.colors.green}/model${Config.colors.reset} or ${Config.colors.green}/mc${Config.colors.reset}     - Switch to a new model using external selector
  ${Config.colors.green}/model help${Config.colors.reset}                - Show this detailed help
  ${Config.colors.green}/model info${Config.colors.reset}                - Show current and previous model information
  ${Config.colors.green}/mb${Config.colors.reset}                         - Toggle back to previous model

${Config.colors.cyan}Setup Instructions:${Config.colors.reset}
To use model switching, set the AICODER_MODELS_BIN environment variable:

${Config.colors.green}export AICODER_MODELS_BIN="/path/to/your/model-selector"${Config.colors.reset}

The model selector should:
- Present a model selection interface (fzf, etc.)
- Return key=value pairs on stdout (one per line)
- Exit with code 0 on success, non-zero on cancellation

${Config.colors.cyan}Example Output from Model Selector:${Config.colors.reset}
API_MODEL=gpt-4
API_KEY=your-key-here
TEMPERATURE=0.7
MAX_TOKENS=4096

${Config.colors.yellow}Note:${Config.colors.reset} 
When switching models, all model-specific configuration variables are reset to prevent 
state pollution between different model types and configurations.
`;

        LogUtils.print(detailedHelp);
    }

    private showModelInfo(): void {
        // Get current model configuration
        const currentConfig: { [key: string]: string } = {};
        MODEL_VARIABLES.forEach(key => {
            if (process.env[key]) {
                currentConfig[key] = process.env[key]!;
            }
        });

        // Format current configuration
        const currentConfigLines = Object.keys(currentConfig).length > 0
            ? Object.entries(currentConfig)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => `  ${Config.colors.cyan}${key}${Config.colors.reset} = ${Config.colors.green}${value}${Config.colors.reset}`)
                .join('\n')
            : `  ${Config.colors.yellow}No model configuration currently set${Config.colors.reset}`;

        // Format previous configuration
        const previousConfigLines = Object.keys(ModelCommand.previousConfig).length > 0
            ? Object.entries(ModelCommand.previousConfig)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => `  ${Config.colors.cyan}${key}${Config.colors.reset} = ${Config.colors.green}${value}${Config.colors.reset}`)
                .join('\n')
            : `  ${Config.colors.yellow}No previous model configuration available${Config.colors.reset}`;

        const modelInfo = `
${Config.colors.bold}${Config.colors.yellow}Model Information${Config.colors.reset}

${Config.colors.cyan}Current Model Configuration:${Config.colors.reset}
${currentConfigLines}

${Config.colors.cyan}Previous Model Configuration:${Config.colors.reset}
${previousConfigLines}
`;

        LogUtils.print(modelInfo);
    }

    // Static methods for ModelBackCommand to access
    static togglePreviousConfig(): boolean {
        if (Object.keys(this.previousConfig).length === 0) {
            return false;
        }
        
        // Take atomic snapshot of current environment for backup
        const currentBackup: { [key: string]: string } = {};
        MODEL_VARIABLES.forEach(key => {
            if (process.env[key]) {
                currentBackup[key] = process.env[key]!;
            }
        });
        
        // Reset ALL model variables first to clean current state
        MODEL_VARIABLES.forEach(key => {
            delete process.env[key];
        });
        
        // Restore previous values to process.env (only if value is not empty)
        Object.entries(this.previousConfig).forEach(([key, value]) => {
            if (value && value.trim() !== '') {
                process.env[key] = value;
            }
        });
        
        // Set previous to current backup for next toggle
        this.previousConfig = currentBackup;
        
        return true;
    }

    static hasPreviousConfig(): boolean {
        return Object.keys(this.previousConfig).length > 0;
    }

    // For testing
    static reset(): void {
        this.previousConfig = {};
    }
}

// Simple command for toggling back to previous model
export class ModelBackCommand extends BaseCommand {
    protected name = 'mb';
    protected description = 'Toggle back to previous model';

    getAliases(): string[] {
        return []; // No aliases for mb
    }

    execute(): CommandResult {
        if (!ModelCommand.hasPreviousConfig()) {
            console.log(`${Config.colors.yellow}No previous model to toggle back to${Config.colors.reset}`);
            return { shouldQuit: false, runApiCall: false };
        }

        ModelCommand.togglePreviousConfig();
        const modelName = process.env.API_MODEL || process.env.OPENAI_MODEL || 'unknown';
        console.log(`${Config.colors.green}✓ Toggled back to model: ${modelName}${Config.colors.reset}`);
        return { shouldQuit: false, runApiCall: false };
    }
}