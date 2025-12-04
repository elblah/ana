/**
 * Tests for tmux popup menu functionality
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { InputHandler } from '../src/core/input-handler.js';
import { Config } from '../src/core/config.js';
import { pluginSystem } from '../src/core/plugin-system.js';
import { ShellUtils } from '../src/utils/shell-utils.js';
import type { PopupMenuItem } from '../src/core/types/index.js';

// Mock dependencies
const mockStats = {
    setLastUserPrompt: () => {},
    incrementTokensUsed: () => {},
    incrementApiCalls: () => {},
    incrementToolCalls: () => {},
    printStats: () => {},
};

const mockMessageHistory = {
    addSystemMessage: () => {},
    addUserMessage: () => {},
    addAssistantMessage: () => {},
    addToolResults: () => {},
    getMessages: () => [],
    shouldAutoCompact: () => false,
    compactMemory: async () => {},
    setApiClient: () => {},
    pruneToolResultsByPercentage: () => ({ prunedCount: 0, savedBytes: 0, protectedCount: 0 }),
};

describe('Tmux Popup Menu', () => {
    let inputHandler: InputHandler;
    let executeCommandSpy: any;

    beforeEach(() => {
        // Reset config state
        Config.detailMode = false;
        Config.setYoloMode(false);
        Config.setSandboxDisabled(false);

        // Mock shell command execution using spyOn
        executeCommandSpy = spyOn(ShellUtils, 'executeCommand').mockResolvedValue({ 
            success: true, 
            exitCode: 0, 
            stdout: '', 
            stderr: '' 
        });

        // Mock temp file operations
        spyOn(require('../src/utils/temp-file-utils.js'), 'createTempFile').mockReturnValue('/tmp/test-menu');
        spyOn(require('node:fs').promises, 'readFile').mockResolvedValue('d');
        spyOn(require('../src/utils/temp-file-utils.js'), 'deleteFile');

        // Create input handler
        inputHandler = new InputHandler();
        inputHandler.setStatsContext(mockStats);
        inputHandler.setMessageHistory(mockMessageHistory as any);
    });

    afterEach(() => {
        // Restore spy
        executeCommandSpy.mockRestore();
        
        // Clean up any registered plugin items
        const popupItems = pluginSystem.getPopupMenuItems();
        for (const [key] of popupItems) {
            pluginSystem.unregisterPopupMenuItem(key);
        }
    });

    it('should build base menu items with correct status', async () => {
        // Set some states
        Config.detailMode = true;
        Config.setYoloMode(true);
        Config.setSandboxDisabled(true);

        // Access the private method through reflection for testing
        const showMenu = (inputHandler as any).showTmuxPopupMenu.bind(inputHandler);
        
        // This should not throw
        await showMenu();

        // Verify the tmux command was called with menu items
        expect(executeCommandSpy).toHaveBeenCalled();
        const tmuxCommand = executeCommandSpy.mock.calls[0][0];
        expect(tmuxCommand).toContain('Toggle Detail (ON)');
        expect(tmuxCommand).toContain('Toggle YOLO (ON)');
        expect(tmuxCommand).toContain('Toggle FS Sandbox (OFF)');
    });

    it('should handle plugin menu items', async () => {
        // Register a test plugin menu item
        const testItem: PopupMenuItem = {
            label: 'Test Item',
            key: 'x',
            handler: () => {
                console.log('Test item clicked');
            },
        };

        pluginSystem.registerPopupMenuItem(testItem);

        // Show menu should include the plugin item
        const showMenu = (inputHandler as any).showTmuxPopupMenu.bind(inputHandler);
        await showMenu();

        // Verify the item was registered
        const items = pluginSystem.getPopupMenuItems();
        expect(items.get('x')).toBeDefined();
        expect(items.get('x')?.label).toBe('Test Item');

        // Verify tmux command includes plugin item
        const tmuxCommand = executeCommandSpy.mock.calls[0][0];
        expect(tmuxCommand).toContain('Test Item');
    });

    it('should allow plugins to update their menu items', async () => {
        // Register initial item
        const testItem: PopupMenuItem = {
            label: 'Test Item (OFF)',
            key: 'x',
            handler: () => {},
        };

        pluginSystem.registerPopupMenuItem(testItem);

        // Update the item
        const updatedItem: PopupMenuItem = {
            label: 'Test Item (ON)',
            key: 'x',
            handler: () => {},
        };

        pluginSystem.updatePopupMenuItem(updatedItem);

        // Verify the update
        const items = pluginSystem.getPopupMenuItems();
        expect(items.get('x')?.label).toBe('Test Item (ON)');
    });

    it('should handle unknown menu selections gracefully', async () => {
        // Mock the temp file to return an unknown selection
        require('node:fs').promises.readFile.mockResolvedValue('unknown');

        // Process the selection
        const processSelection = (inputHandler as any).processMenuSelection.bind(inputHandler);
        await processSelection('unknown');

        // Should not throw
        expect(true).toBe(true);
    });

    it('should toggle detail mode correctly', async () => {
        const initialDetail = Config.detailMode;
        
        // Toggle via menu selection
        const processSelection = (inputHandler as any).processMenuSelection.bind(inputHandler);
        await processSelection('d');

        expect(Config.detailMode).toBe(!initialDetail);
    });

    it('should toggle YOLO mode correctly', async () => {
        const initialYolo = Config.yoloMode;
        
        // Toggle via menu selection
        const processSelection = (inputHandler as any).processMenuSelection.bind(inputHandler);
        await processSelection('y');

        expect(Config.yoloMode).toBe(!initialYolo);
    });

    it('should toggle filesystem sandbox correctly', async () => {
        const initialSandbox = Config.sandboxDisabled;
        
        // Toggle via menu selection
        const processSelection = (inputHandler as any).processMenuSelection.bind(inputHandler);
        await processSelection('f');

        expect(Config.sandboxDisabled).toBe(!initialSandbox);
    });
});

describe('Plugin System Integration', () => {
    it('should provide popup menu registration in context', () => {
        const context = pluginSystem.getContext();
        
        expect(typeof context.registerPopupMenuItem).toBe('function');
        expect(typeof context.unregisterPopupMenuItem).toBe('function');
    });

    it('should track popup menu items separately from plugins', () => {
        const testItem: PopupMenuItem = {
            label: 'Test Item',
            key: 'test',
            handler: () => {},
        };

        // Register popup item
        pluginSystem.registerPopupMenuItem(testItem);

        // Verify it's in popup items but not in plugins
        const popupItems = pluginSystem.getPopupMenuItems();
        const plugins = pluginSystem.getPlugins();

        expect(popupItems.get('test')).toBeDefined();
        expect(plugins.get('test')).toBeUndefined();

        // Clean up
        pluginSystem.unregisterPopupMenuItem('test');
    });

    it('should cleanup popup items on plugin system cleanup', () => {
        const testItem: PopupMenuItem = {
            label: 'Test Item',
            key: 'test',
            handler: () => {},
        };

        // Register popup item
        pluginSystem.registerPopupMenuItem(testItem);
        expect(pluginSystem.getPopupMenuItems().get('test')).toBeDefined();

        // Cleanup
        pluginSystem.cleanup();

        // Verify items are cleared
        expect(pluginSystem.getPopupMenuItems().size).toBe(0);
    });
});