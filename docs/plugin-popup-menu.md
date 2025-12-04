# Plugin Popup Menu API

Plugins can now register custom menu items in the tmux popup menu (Ctrl+Z). This allows plugins to provide quick access to their functionality directly from the user interface.

## Overview

The popup menu system allows plugins to:
- Register menu items with custom labels and hotkeys
- Update menu item labels dynamically (e.g., to show current status)
- Handle menu item selections with custom logic

## API Reference

### PopupMenuItem Interface

```typescript
interface PopupMenuItem {
    label: string;    // Display text in menu (can include status like "(ON)")
    key: string;       // Hotkey for the menu item
    handler: () => void | Promise<void>;  // Function to execute when selected
}
```

### PluginContext Methods

```typescript
// Register a new popup menu item
registerPopupMenuItem(item: PopupMenuItem): void;

// Remove a popup menu item by key
unregisterPopupMenuItem(key: string): void;
```

### Plugin System Methods

```typescript
// Update an existing menu item (useful for dynamic labels)
pluginSystem.updatePopupMenuItem(item: PopupMenuItem): void;

// Get all registered popup menu items
pluginSystem.getPopupMenuItems(): Map<string, PopupMenuItem>;
```

## Usage Example

### Basic Registration

```typescript
export default function createPlugin(ctx: PluginContext): Plugin {
    // Register a simple menu item
    ctx.registerPopupMenuItem({
        label: 'My Plugin Action',
        key: 'm',
        handler: () => {
            console.log('My plugin action executed!');
        },
    });

    return {
        name: 'My Plugin',
        version: '1.0.0',
        description: 'A plugin with popup menu support',
    };
}
```

### Dynamic Status Updates

```typescript
export default function createPlugin(ctx: PluginContext): Plugin {
    let enabled = false;

    // Function to update menu item with current status
    const updateMenuItem = () => {
        const status = enabled ? 'ON' : 'OFF';
        ctx.registerPopupMenuItem({
            label: `Toggle My Feature (${status})`,
            key: 'x',
            handler: () => {
                enabled = !enabled;
                ctx.setConfig('my_feature.enabled', enabled.toString());
                updateMenuItem(); // Update label with new status
                console.log(`My feature ${enabled ? 'enabled' : 'disabled'}`);
            },
        });
    };

    // Initial registration
    updateMenuItem();

    // Load saved state
    const savedState = ctx.getConfig('my_feature.enabled');
    if (savedState === 'true') {
        enabled = true;
        updateMenuItem(); // Update label
    }

    return {
        name: 'My Plugin',
        version: '1.0.0',
        description: 'A plugin with dynamic popup menu',
    };
}
```

## Integration with Input Handler

The popup menu system integrates with the main tmux popup menu in `InputHandler.showTmuxPopupMenu()`. When users press Ctrl+Z, the menu displays:

1. Core application items (Detail, YOLO, FS Sandbox, etc.)
2. Plugin-registered items (automatically included)

## Key Assignment Guidelines

- Use unique keys that don't conflict with core items
- Core items use: `d` (detail), `s` (stop), `y` (yolo), `f` (fs), `p` (prune), `t` (stats), `e` (save), `q` (quit)
- Plugins should use other letters or numbers
- Consider using mnemonic keys related to your plugin's functionality

## Best Practices

1. **Status Indicators**: Always show current status in the label (e.g., `(ON)`, `(OFF)`)
2. **Immediate Updates**: Update menu labels immediately when state changes
3. **User Feedback**: Provide console feedback when actions are executed
4. **Configuration Persistence**: Save state using `ctx.setConfig()` and load it on startup
5. **Error Handling**: Wrap handlers in try-catch to prevent menu failures

## Example: Network Sandbox Plugin

The network sandbox plugin demonstrates the full API usage:

```typescript
// Register popup menu item with dynamic status
const updatePopupMenuItem = () => {
    const status = enabled ? 'ON' : 'OFF';
    ctx.registerPopupMenuItem({
        label: `Toggle Net Sandbox (${status})`,
        key: 'n',
        handler: () => {
            enabled = !enabled;
            ctx.setConfig('sandbox_network.enabled', enabled.toString());
            updatePopupMenuItem(); // Update the label
            console.log(`[*] Network sandbox ${enabled ? 'ENABLED' : 'DISABLED'}`);
        },
    });
};
```

## Testing

Use the test framework to verify popup menu integration:

```typescript
// Register a test item
pluginSystem.registerPopupMenuItem({
    label: 'Test Item',
    key: 'x',
    handler: () => console.log('Test executed'),
});

// Verify registration
const items = pluginSystem.getPopupMenuItems();
expect(items.get('x')).toBeDefined();

// Test update
pluginSystem.updatePopupMenuItem({
    label: 'Test Item (UPDATED)',
    key: 'x',
    handler: () => console.log('Test executed'),
});
```

## Cleanup

When plugins are unloaded, their popup menu items are automatically cleaned up during `pluginSystem.cleanup()`.