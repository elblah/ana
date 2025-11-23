import type { Plugin, PluginContext } from '../../src/core/plugin-system.js';

// Configuration
const TTS_PROMPT = 'prompt available';
const TTS_APPROVAL_AVAILABLE = 'approval available';

// Inside firejail there is no /dev/null so we use another
const DEV_NULL =
    process.env.container === undefined
        ? '/dev/null'
        : `${process.env.XDG_RUNTIME_DIR || '/tmp'}/.notify_null`;

let currentSink = '';
let environmentReady = false;

async function detectEnvironment(): Promise<void> {
    // Detect audio sink (async for faster init)
    try {
        const { exec } = await import('node:child_process');
        const { promisify } = await import('node:util');
        const execAsync = promisify(exec);

        // Try to detect HDMI sink first, fallback to pipewire
        try {
            const { stdout } = await execAsync(
                `pactl list sinks short 2> ${DEV_NULL} | grep hdmi | awk '{print $2}'`
            );
            currentSink = stdout.trim() || 'pipewire/combined';
        } catch {
            currentSink = 'pipewire/combined';
        }
    } catch {
        currentSink = 'pipewire/combined';
    }

    // Mark environment as ready
    environmentReady = true;
}

function say(msg: string): void {
    // Don't speak until environment is ready
    if (!environmentReady) {
        return;
    }

    // Run in background to not block
    (async () => {
        try {
            const { exec } = await import('node:child_process');
            const { promisify } = await import('node:util');
            const execAsync = promisify(exec);

            await execAsync(`PULSE_SINK='${currentSink}' espeak '${msg}' 2> ${DEV_NULL}`, {
                timeout: 5000,
            });
        } catch (error) {
            // Silently fail - notification isn't critical
        }
    })();
}

async function shouldNotify(): Promise<boolean> {
    // Check if .notify-prompt file exists in project directory
    try {
        const { access } = await import('node:fs/promises');
        await access('.notify-prompt');
        return true;
    } catch {
        return false;
    }
}

// Hook functions
async function onBeforeUserPrompt(): Promise<void> {
    if (await shouldNotify()) {
        say(TTS_PROMPT);
    }
}

async function onBeforeApprovalPrompt(): Promise<void> {
    if (await shouldNotify()) {
        say(TTS_APPROVAL_AVAILABLE);
    }
}

// Simplified plugin implementation - using the single API
export default function createNotifyPromptPlugin(ctx: PluginContext): Plugin {
    // Initialize environment detection asynchronously (non-blocking)
    detectEnvironment();

    return {
        name: 'Notify Prompt Plugin',
        version: '1.0.0',
        description: 'Audio notifications for prompts and approvals',
        initialize: () => {
            // Set up event hooks if the app supports them
            if (ctx.registerNotifyHooks && typeof ctx.registerNotifyHooks === 'function') {
                // Register hooks using the proper API
                ctx.registerNotifyHooks({
                    onBeforeUserPrompt,
                    onBeforeApprovalPrompt,
                });
            }
        },
        cleanup: () => {
            // Clean up hooks - hooks are automatically cleaned up when plugin is unloaded
            // No need to manually delete as we're using proper registration
        },
    };
}

// Export the hook functions for the app to call directly
export { onBeforeUserPrompt, onBeforeApprovalPrompt };
