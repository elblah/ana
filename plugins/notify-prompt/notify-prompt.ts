import type { Plugin, PluginContext } from '../../src/core/plugin-system.js';

// Configuration
const ENABLED = true;
const NOTIFY_ONLY_IF_TMUX_PANE_IS_NOT_VISIBLE = !process.env.ALWAYS_NOTIFY;
const PREFER_SINK = "hdmi";
const ALTERNATIVE_SINK = "pipewire/combined";
const TTS_PROMPT = "prompt available";
const TTS_APPROVAL_AVAILABLE = "approval available";

// Inside firejail there is no /dev/null so we use another
const DEV_NULL = process.env.container === undefined ? "/dev/null" : `${process.env.XDG_RUNTIME_DIR || "/tmp"}/.notify_null`;

let currentSink: string = "";
let tmuxPane = process.env.TMUX_PANE || "";

// Plugin context for event hooks
let pluginCtx: PluginContext | null = null;

async function detectSink(): Promise<void> {
  try {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync(`pactl list sinks short 2> ${DEV_NULL} | grep ${PREFER_SINK} | awk '{print $2}'`);
      currentSink = stdout.trim() || ALTERNATIVE_SINK;
    } catch {
      currentSink = ALTERNATIVE_SINK;
    }
  } catch {
    currentSink = ALTERNATIVE_SINK;
  }
}

function say(msg: string): void {
  if (!ENABLED) return;

  // Run in background
  (async () => {
    try {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(exec);

      await execAsync(`PULSE_SINK='${currentSink}' espeak '${msg}' 2> ${DEV_NULL}`, {
        timeout: 5000
      });
    } catch (error) {
      // Silently fail - notification isn't critical
    }
  })();
}

async function shouldNotify(): Promise<boolean> {
  if (!ENABLED) return false;
  
  // If ALWAYS_NOTIFY is set, always notify
  if (!NOTIFY_ONLY_IF_TMUX_PANE_IS_NOT_VISIBLE) return true;
  
  // If not in tmux, always notify
  if (!tmuxPane) return true;

  // Check if .notify-prompt file exists (force notify)
  try {
    const { access } = await import('node:fs/promises');
    await access('.notify-prompt');
    return true;
  } catch {
    // File doesn't exist, continue checking
  }

  // Check if tmux pane is active
  try {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    const { stdout } = await execAsync(`tmux display -p -t "${tmuxPane}" '#{{window_active}}'`);
    // Notify if pane is NOT active (output != "1") or if command failed
    return stdout.trim() !== "1";
  } catch {
    // Command failed, assume we should notify
    return true;
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

// Plugin implementation
export default function createNotifyPromptPlugin(ctx: PluginContext): Plugin {
  pluginCtx = ctx;
  
  // Initialize audio sink
  detectSink();

  // Register command to control notifications
  function handleNotifyCommand(args: string[]): boolean | void {
    if (!args.length) {
      const status = `Notify Prompt Plugin Status

- **Enabled**: [${ENABLED ? '✓' : 'X'}] ${ENABLED ? 'Yes' : 'No'}
- **TMUX Awareness**: [${NOTIFY_ONLY_IF_TMUX_PANE_IS_NOT_VISIBLE ? '✓' : 'X'}] ${NOTIFY_ONLY_IF_TMUX_PANE_IS_NOT_VISIBLE ? 'Only notify when pane inactive' : 'Always notify'}
- **Current Sink**: ${currentSink}
- **TMUX Pane**: ${tmuxPane || 'Not in tmux'}

**Commands:**
- \`/notify status\` - Show current status
- \`/notify test\` - Test notification sound
- \`/notify help\` - Show this help

**Environment Variables:**
- \`ALWAYS_NOTIFY=1\` - Disable TMUX awareness, always notify
- \`ESPEAK_OPTS\` - Additional options for espeak`;
      
      console.log(status);
      return;
    }

    const cmd = args[0].toLowerCase();

    switch (cmd) {
      case 'status':
        // Same as no args - show status
        return handleNotifyCommand([]);
        
      case 'test':
        say("test notification");
        console.log('[*] Test notification sent');
        break;
        
      case 'help':
        const helpText = `Notify Prompt Plugin

This plugin provides audio notifications when user input or tool approval is needed.
Works well with TMUX by only notifying when the current pane is not visible.

**Commands:**
- \`/notify\` - Show current status
- \`/notify status\` - Show current status
- \`/notify test\` - Test notification sound
- \`/notify help\` - Show this help

**Features:**
- Audio notifications for prompts and approvals
- TMUX integration (only notifies when pane inactive)
- Configurable audio sink (HDMI/PIPewire)
- Environment variable configuration

**Environment Variables:**
- \`ALWAYS_NOTIFY=1\` - Disable TMUX awareness, always notify
- \`ESPEAK_OPTS\` - Additional options for espeak (e.g., "-s 120" for speech speed)

**Requirements:**
- \`espeak\` - Text-to-speech engine
- \`pactl\` - For audio sink selection (PulseAudio)
- Optional: \`tmux\` - For pane awareness`;
        console.log(helpText);
        break;
        
      default:
        console.log(`[X] Unknown notify command: ${cmd}. Use \`/notify help\` for available commands.`);
    }
  }

  // Register command
  ctx.registerCommand('/notify', handleNotifyCommand, 'Configure audio notifications for prompts');

  return {
    name: 'Notify Prompt Plugin',
    version: '1.0.0',
    description: 'Audio notifications for prompts and approvals (TMUX aware)',
    initialize: () => {
      // Set up event hooks if the app supports them
      if (ctx.app && typeof ctx.app === 'object') {
        // Try to register hooks - these would be called by the main app
        (ctx.app as any)._notifyPromptHooks = {
          onBeforeUserPrompt,
          onBeforeApprovalPrompt
        };
      }
    },
    cleanup: () => {
      // Clean up hooks
      if (ctx.app && typeof ctx.app === 'object') {
        delete (ctx.app as any)._notifyPromptHooks;
      }
    }
  };
}

// Export the hook functions for the app to call directly
export { onBeforeUserPrompt, onBeforeApprovalPrompt };