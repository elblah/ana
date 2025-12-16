/**
 * Configuration module for AI Coder
 */

export class Config {
    // API Configuration
    static get apiKey(): string {
        return process.env.OPENAI_API_KEY || process.env.API_KEY || '';
    }

    static get baseUrl(): string {
        return process.env.OPENAI_BASE_URL || process.env.API_BASE_URL || '';
    }

    static get apiEndpoint(): string {
        return `${this.baseUrl}/chat/completions`;
    }

    static get model(): string {
        return process.env.OPENAI_MODEL || process.env.API_MODEL || '';
    }

    static get temperature(): number {
        const temp = process.env.TEMPERATURE;
        return temp ? Number.parseFloat(temp) : 0.0;
    }

    static get maxTokens(): number | null {
        const maxTokens = process.env.MAX_TOKENS;
        return maxTokens ? Number.parseInt(maxTokens, 10) : null;
    }

    // Streaming Configuration
    static get streamingTimeout(): number {
        return Number.parseInt(process.env.STREAMING_TIMEOUT || '300', 10);
    }

    static get streamingReadTimeout(): number {
        return Number.parseInt(process.env.STREAMING_READ_TIMEOUT || '30', 10);
    }

    static get totalTimeout(): number {
        return Number.parseInt(process.env.TOTAL_TIMEOUT || '300', 10) * 1000;
    }

    // Context and Memory Configuration
    static get contextSize(): number {
        return Number.parseInt(process.env.CONTEXT_SIZE || '128000', 10);
    }

    static get contextCompactPercentage(): number {
        return Number.parseInt(process.env.CONTEXT_COMPACT_PERCENTAGE || '0', 10);
    }

    static get autoCompactThreshold(): number {
        if (this.contextCompactPercentage > 0) {
            const cappedPercentage = Math.min(this.contextCompactPercentage, 100);
            return Math.floor(this.contextSize * (cappedPercentage / 100));
        }
        return 0;
    }

    static get autoCompactEnabled(): boolean {
        return this.autoCompactThreshold > 0;
    }

    static get tmuxPrunePercentage(): number {
        return Number.parseInt(process.env.TMUX_PRUNE_PERCENTAGE || '50', 10);
    }

    // Compaction Configuration
    static get compactProtectRounds(): number {
        return Number.parseInt(process.env.COMPACT_PROTECT_ROUNDS || '2', 10);
    }

    static get minSummaryLength(): number {
        return Number.parseInt(process.env.MIN_SUMMARY_LENGTH || '100', 10);
    }

    static get forceCompactSize(): number {
        return Number.parseInt(process.env.FORCE_COMPACT_SIZE || '5', 10);
    }

    // Retry Configuration
    static get maxRetries(): number {
        return Number.parseInt(process.env.MAX_RETRIES || '3', 10);
    }

    static get retryMaxWait(): number {
        return Number.parseInt(process.env.RETRY_MAX_WAIT || '64', 10);
    }

    // Runtime Retry Configuration (overrides environment variables)
    private static _runtimeMaxRetries: number | null = null;
    private static _runtimeRetryMaxWait: number | null = null;
    private static _runtimeAutoRetry: boolean | null = null;

    // Getters that check runtime state first, then environment
    static get effectiveMaxRetries(): number {
        return this._runtimeMaxRetries ?? this.maxRetries;
    }

    static get effectiveRetryMaxWait(): number {
        return this._runtimeRetryMaxWait ?? this.retryMaxWait;
    }

    static get effectiveAutoRetry(): boolean {
        if (this._runtimeAutoRetry !== null) {
            return this._runtimeAutoRetry;
        }
        // Default to enabled (current behavior)
        return true;
    }

    // Setters for runtime configuration
    static setRuntimeMaxRetries(value: number | null): void {
        this._runtimeMaxRetries = value;
    }

    static setRuntimeRetryMaxWait(value: number | null): void {
        this._runtimeRetryMaxWait = value;
    }

    static setRuntimeAutoRetry(value: boolean | null): void {
        this._runtimeAutoRetry = value;
    }

    // Get current configuration state
    static getRetryConfigStatus(): {
        maxRetries: number;
        maxBackoff: number;
        autoRetry: boolean;
        isRuntimeOverrides: boolean;
    } {
        return {
            maxRetries: this.effectiveMaxRetries,
            maxBackoff: this.effectiveRetryMaxWait,
            autoRetry: this.effectiveAutoRetry,
            isRuntimeOverrides: this._runtimeMaxRetries !== null || this._runtimeRetryMaxWait !== null || this._runtimeAutoRetry !== null
        };
    }

    // Tool Configuration
    static get maxToolResultSize(): number {
        return Number.parseInt(process.env.MAX_TOOL_RESULT_SIZE || '300000', 10);
    }



    // YOLO mode state
    private static _yoloMode = false;

    static get yoloMode(): boolean {
        // Check environment variable first
        if (process.env.YOLO_MODE === '1') {
            return true;
        }
        // Fall back to runtime state
        return this._yoloMode;
    }

    static setYoloMode(enabled: boolean): void {
        this._yoloMode = enabled;
    }

    // Auto-council context reset mode
    private static _autoCouncilResetContext = true;

    static get autoCouncilResetContext(): boolean {
        // Check environment variable first
        if (process.env.AUTO_COUNCIL_RESET_CONTEXT === '0') {
            return false;
        } else if (process.env.AUTO_COUNCIL_RESET_CONTEXT === '1') {
            return true;
        }
        // Fall back to runtime state
        return this._autoCouncilResetContext;
    }

    static setAutoCouncilResetContext(enabled: boolean): void {
        this._autoCouncilResetContext = enabled;
    }

    private static _sandboxDisabled = false;
    private static _detailMode = false;

    static get detailMode(): boolean {
        return this._detailMode;
    }

    static set detailMode(enabled: boolean) {
        this._detailMode = enabled;
    }

    static get sandboxDisabled(): boolean {
        // Check both environment variable and runtime state
        return process.env.MINI_SANDBOX === '0' || this._sandboxDisabled;
    }

    static setSandboxDisabled(disabled: boolean): void {
        this._sandboxDisabled = disabled;
        if (disabled) {
            console.log(
                `${this.colors.yellow}[*] Sandbox temporarily disabled for this session${this.colors.reset}`
            );
        } else {
            console.log(
                `${this.colors.green}[*] Sandbox re-enabled for this session${this.colors.reset}`
            );
        }
    }

    // Plugin Configuration
    static get disablePlugins(): boolean {
        const disableValue = process.env.DISABLE_PLUGINS;
        return disableValue === '1' || disableValue === 'true';
    }

    // Debug and Development
    static get debug(): boolean {
        return process.env.DEBUG === '1';
    }

    // No fallbacks - use only configured provider
    static get fallbackConfigs(): Array<{ baseUrl: string; model: string }> {
        return [];
    }

    // ANSI Colors for terminal output
    static readonly colors = {
        reset: '\x1b[0m',
        bold: '\x1b[1m',
        dim: '\x1b[2m',
        black: '\x1b[30m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        brightGreen: '\x1b[92m',
        brightRed: '\x1b[91m',
        brightYellow: '\x1b[93m',
        brightBlue: '\x1b[94m',
        brightMagenta: '\x1b[95m',
        brightCyan: '\x1b[96m',
        brightWhite: '\x1b[97m',
    };

    // Validate required configuration
    static validateConfig(): void {
        if (!this.baseUrl) {
            console.error(
                `${this.colors.red}Error: Missing required environment variable:${this.colors.reset}`
            );
            console.error(
                `${this.colors.red}  - API_BASE_URL or OPENAI_BASE_URL${this.colors.reset}`
            );
            console.error(`${this.colors.reset}`);
            console.error(`${this.colors.cyan}Example configuration:${this.colors.reset}`);
            console.error(
                `${this.colors.cyan}  export API_BASE_URL="https://your-api-provider.com/v1"${this.colors.reset}`
            );
            console.error(`${this.colors.reset}`);
            console.error(`${this.colors.yellow}Optional variables:${this.colors.reset}`);
            console.error(
                `${this.colors.yellow}  export API_KEY="your-api-key-here" (optional, some providers don't require it)${this.colors.reset}`
            );
            console.error(
                `${this.colors.yellow}  export API_MODEL="your-model-name" (optional, some providers have a default)${this.colors.reset}`
            );
            console.error(`${this.colors.yellow}  export TEMPERATURE=0.0${this.colors.reset}`);
            console.error(`${this.colors.yellow}  export MAX_TOKENS=4096${this.colors.reset}`);
            console.error(`${this.colors.yellow}  export DEBUG=1${this.colors.reset}`);
            process.exit(1);
        }
    }

    // Print configuration info at startup
    static printStartupInfo(): void {
        console.log(`${this.colors.green}Configuration:${this.colors.reset}`);
        console.log(`${this.colors.green}  API Endpoint: ${this.apiEndpoint}${this.colors.reset}`);
        console.log(`${this.colors.green}  Model: ${this.model}${this.colors.reset}`);

        if (this.debug) {
            console.log(`${this.colors.yellow}DEBUG MODE IS ON${this.colors.reset}`);
        }

        if (process.env.TEMPERATURE) {
            console.log(
                `${this.colors.green}  Temperature: ${this.temperature}${this.colors.reset}`
            );
        }

        if (process.env.MAX_TOKENS) {
            console.log(`${this.colors.green}  Max tokens: ${this.maxTokens}${this.colors.reset}`);
        }

        if (this.autoCompactEnabled) {
            console.log(
                `${this.colors.green}  Auto-compaction enabled (context: ${this.contextSize} tokens, triggers at ${this.contextCompactPercentage}%)${this.colors.reset}`
            );
        }

        if (Config.autoCouncilResetContext) {
            console.log(
                `${this.colors.green}  Auto-council uses context reset (fresh context each turn)${this.colors.reset}`
            );
        } else {
            console.log(
                `${this.colors.yellow}  Auto-council preserves context (traditional approach)${this.colors.reset}`
            );
        }
    }

    /**
     * Reset all runtime state to defaults (for testing)
     * Restores all mutable static properties to their initial values
     */
    static reset(): void {
        this._yoloMode = false;
        this._autoCouncilResetContext = true; // Default to true
        this._sandboxDisabled = false;
        this._detailMode = false;
        this._runtimeMaxRetries = null;
        this._runtimeRetryMaxWait = null;
        this._runtimeAutoRetry = null;
    }
}
