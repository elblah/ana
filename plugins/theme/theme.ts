import type { Plugin, PluginContext } from '../../src/core/plugin-system.js';

// Theme definitions - full TS type safety during development
const THEMES = {
    ansi: {
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        reset: '\x1b[0m',
        dim: '\x1b[2m',
    },

    // Luna - beautiful pink/cyan theme
    luna: {
        red: '\x1b[38;2;255;175;255m',
        green: '\x1b[38;2;215;255;95m',
        yellow: '\x1b[38;2;255;215;0m',
        blue: '\x1b[38;2;175;255;255m',
        magenta: '\x1b[38;2;255;175;255m',
        cyan: '\x1b[38;2;175;255;255m',
        white: '\x1b[38;2;255;255;255m',
        reset: '\x1b[0m',
        dim: '\x1b[2m',
    },

    'one-dark-pro': {
        red: '\x1b[38;2;255;50;50m',
        green: '\x1b[38;2;80;250;123m',
        yellow: '\x1b[38;2;255;220;95m',
        blue: '\x1b[38;2;97;175;239m',
        magenta: '\x1b[38;2;198;120;221m',
        cyan: '\x1b[38;2;139;233;253m',
        white: '\x1b[38;2;197;200;198m',
        reset: '\x1b[0m',
        dim: '\x1b[2m',
    },
};

// Plugin implementation - using the single API
export default function createThemePlugin(ctx: PluginContext): Plugin {
    let currentTheme = 'ansi';

    function applyTheme(themeName: string, showOutput = true): boolean {
        const theme = THEMES[themeName as keyof typeof THEMES];
        if (!theme) {
            console.log(
                `Theme '${themeName}' not found. Available: ${Object.keys(THEMES).join(', ')}`
            );
            return false;
        }

        // Apply to global Config.colors
        Object.assign(ctx.config.colors, theme);
        currentTheme = themeName;

        // Save to config
        ctx.setConfig('theme', themeName);

        if (showOutput) {
            // Test the new theme
            const colors = ctx.config.colors;
            console.log(
                `${colors.cyan}Theme changed to: ${colors.yellow}${themeName}${colors.reset}`
            );
            console.log(
                `${colors.red}Red${colors.green} Green${colors.yellow} Yellow${colors.blue} Blue${colors.magenta} Magenta${colors.cyan} Cyan${colors.white} White${colors.reset}`
            );
        }

        return true;
    }

    // Command handler
    function handleThemeCommand(args: string[]): boolean | undefined {
        if (!args.length) {
            const colors = ctx.config.colors;
            console.log(
                `${colors.cyan}Current theme: ${colors.yellow}${currentTheme}${colors.reset}`
            );
            console.log(
                `${colors.dim}Available themes: ${Object.keys(THEMES).join(', ')}${colors.reset}`
            );
            console.log(`${colors.dim}Usage: /theme <name>${colors.reset}`);
            return;
        }

        applyTheme(args[0]);
    }

    // Register command
    ctx.registerCommand('/theme', handleThemeCommand, 'Change color theme');

    // Try to load saved theme from config
    const savedTheme = ctx.getConfig('theme') as string;
    if (savedTheme && typeof savedTheme === 'string') {
        applyTheme(savedTheme, false);
    }

    return {
        name: 'Theme Plugin',
        version: '1.0.0',
        description: 'Color theme management for terminal output',
    };
}
