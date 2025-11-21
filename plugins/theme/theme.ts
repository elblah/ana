import type { PluginContext } from '../../src/core/plugin-system.js';

// Theme definitions - full TS type safety during development
const THEMES = {
  ansi: {
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    reset: "\x1b[0m",
    dim: "\x1b[2m",
  },

  // Luna - beautiful pink/cyan theme
  luna: {
    red: "\x1b[38;2;255;175;255m",
    green: "\x1b[38;2;215;255;95m",
    yellow: "\x1b[38;2;255;215;0m",
    blue: "\x1b[38;2;175;255;255m",
    magenta: "\x1b[38;2;255;175;255m",
    cyan: "\x1b[38;2;175;255;255m",
    white: "\x1b[38;2;255;255;255m",
    reset: "\x1b[0m",
    dim: "\x1b[2m",
  },

  "one-dark-pro": {
    red: "\x1b[38;2;255;50;50m",
    green: "\x1b[38;2;80;250;123m",
    yellow: "\x1b[38;2;255;220;95m",
    blue: "\x1b[38;2;97;175;239m",
    magenta: "\x1b[38;2;198;120;221m",
    cyan: "\x1b[38;2;139;233;253m",
    white: "\x1b[38;2;197;200;198m",
    reset: "\x1b[0m",
    dim: "\x1b[2m",
  }
};

export default function createThemePlugin(ctx: PluginContext) {
  let currentTheme = 'ansi';

  function applyTheme(themeName: string, showOutput: boolean = true): boolean {
    const theme = THEMES[themeName as keyof typeof THEMES];
    if (!theme) {
      console.log(`Theme '${themeName}' not found. Available: ${Object.keys(THEMES).join(', ')}`);
      return false;
    }

    // Use app's config directly
    Object.assign(ctx.config.colors, theme);
    currentTheme = themeName;
    ctx.setConfig('theme.current', themeName);
    
    console.log(`[+] Applied theme: ${themeName}`);
    return true;
  }

  function handleThemeCommand(args: string[]): boolean {
    if (!args || args.length === 0) {
      console.log(`\n${ctx.config.colors.green}Current theme: ${currentTheme}${ctx.config.colors.reset}`);
      return false;
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'list': {
        console.log(`\n${ctx.config.colors.green}Available themes:${ctx.config.colors.reset}`);
        Object.keys(THEMES).forEach(name => {
          const marker = name === currentTheme ? ' (current)' : '';
          console.log(`  ${name}${marker}`);
        });
        return false;
      }

      case 'help': {
        console.log(`\n${ctx.config.colors.green}Theme Command Help:${ctx.config.colors.reset}`);
        console.log(`  ${ctx.config.colors.cyan}/theme${ctx.config.colors.reset}                    - Show current theme`);
        console.log(`  ${ctx.config.colors.cyan}/theme list${ctx.config.colors.reset}              - List all themes`);
        console.log(`  ${ctx.config.colors.cyan}/theme <name>${ctx.config.colors.reset}            - Apply theme`);
        console.log(`  ${ctx.config.colors.cyan}/theme help${ctx.config.colors.reset}              - Show this help`);
        return false;
      }

      default:
        return applyTheme(subcommand);
    }
  }

  // Register the command using the app context
  ctx.registerCommand('/theme', handleThemeCommand, 'Switch terminal color themes');

  // Restore saved theme
  const savedTheme = ctx.getConfig('theme.current');
  if (savedTheme && THEMES[savedTheme as keyof typeof THEMES]) {
    applyTheme(savedTheme);
  } else if (process.env.AICODER_THEME) {
    const envTheme = process.env.AICODER_THEME;
    if (THEMES[envTheme as keyof typeof THEMES]) {
      applyTheme(envTheme);
    }
  }

  return {
    name: 'Theme Plugin',
    version: '1.0.0',
    description: 'High contrast terminal themes'
  };
}