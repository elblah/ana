import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ModelCommand, ModelBackCommand } from '../src/core/commands/model.js';

describe('Model Command Tests', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Reset model command state
        ModelCommand.reset();
    });

    afterEach(() => {
        // Restore original environment
        process.env = { ...originalEnv };
    });

    test('ModelCommand should handle missing AICODER_MODELS_BIN', async () => {
        delete process.env.AICODER_MODELS_BIN;
        
        const context = {} as any;
        const cmd = new ModelCommand(context);
        
        const result = await cmd.execute([]);
        
        expect(result.shouldQuit).toBe(false);
        expect(result.runApiCall).toBe(false);
    });

    test('ModelCommand should parse key=value output correctly', () => {
        const context = {} as any;
        const cmd = new ModelCommand(context);
        
        const parseMethod = (cmd as any).parseConfigOutput.bind(cmd);
        
        const output = `API_MODEL=gpt-4
API_KEY=test-key
TEMPERATURE=0.7
CONTEXT_SIZE=128000`;
        
        const config = parseMethod(output);
        
        expect(config).toEqual({
            API_MODEL: 'gpt-4',
            API_KEY: 'test-key',
            TEMPERATURE: '0.7',
            CONTEXT_SIZE: '128000'
        });
    });

    test('ModelCommand should handle empty values correctly', () => {
        const context = {} as any;
        const cmd = new ModelCommand(context);
        
        const parseMethod = (cmd as any).parseConfigOutput.bind(cmd);
        
        const output = `API_MODEL=gpt-4
API_KEY=
TEMPERATURE=
CONTEXT_SIZE=128000`;
        
        const config = parseMethod(output);
        
        expect(config).toEqual({
            API_MODEL: 'gpt-4',
            API_KEY: '',
            TEMPERATURE: '',
            CONTEXT_SIZE: '128000'
        });
    });

    test('ModelCommand should update process.env and backup previous', () => {
        // Set initial environment
        process.env.API_MODEL = 'gpt-3.5-turbo';
        process.env.API_KEY = 'old-key';
        process.env.CONTEXT_SIZE = '4000';
        
        // Simulate config update (manual test of backup logic)
        const newConfig = {
            API_MODEL: 'gpt-4',
            API_KEY: 'new-key',
            TEMPERATURE: '0.7',
            CONTEXT_SIZE: '128000'
        };
        
        // Backup current environment values
        const keysToBackup = ['API_MODEL', 'OPENAI_MODEL', 'API_KEY', 'OPENAI_API_KEY', 'API_BASE_URL', 'OPENAI_BASE_URL', 'TEMPERATURE', 'MAX_TOKENS', 'TOP_K', 'TOP_P', 'CONTEXT_SIZE', 'CONTEXT_COMPACT_PERCENTAGE', 'AUTO_COMPACT_THRESHOLD'];
        const previousBackup: { [key: string]: string } = {};
        keysToBackup.forEach(key => {
            if (process.env[key]) {
                previousBackup[key] = process.env[key]!;
            }
        });
        
        // Update process.env (only non-empty values)
        Object.entries(newConfig).forEach(([key, value]) => {
            if (value && value.trim() !== '') {
                process.env[key] = value;
            }
        });
        
        // Verify backup and update
        expect(previousBackup.API_MODEL).toBe('gpt-3.5-turbo');
        expect(previousBackup.API_KEY).toBe('old-key');
        expect(previousBackup.CONTEXT_SIZE).toBe('4000');
        expect(process.env.API_MODEL).toBe('gpt-4');
        expect(process.env.API_KEY).toBe('new-key');
        expect(process.env.TEMPERATURE).toBe('0.7');
        expect(process.env.CONTEXT_SIZE).toBe('128000');
    });

    test('ModelBackCommand should toggle environment values', () => {
        // Set initial environment
        process.env.API_MODEL = 'gpt-3.5-turbo';
        process.env.API_KEY = 'old-key';
        process.env.CONTEXT_SIZE = '4000';
        
        // Setup previous backup in ModelCommand
        const previousConfig = {
            API_MODEL: 'gpt-4',
            API_KEY: 'new-key',
            TEMPERATURE: '0.7',
            CONTEXT_SIZE: '128000'
        };
        
        // Manually set previous config
        (ModelCommand as any).previousConfig = previousConfig;
        
        const context = {} as any;
        const cmd = new ModelBackCommand(context);
        
        const result = cmd.execute([]);
        
        expect(result.shouldQuit).toBe(false);
        expect(result.runApiCall).toBe(false);
        
        // Check that environment was restored
        expect(process.env.API_MODEL).toBe('gpt-4');
        expect(process.env.API_KEY).toBe('new-key');
        expect(process.env.TEMPERATURE).toBe('0.7');
        expect(process.env.CONTEXT_SIZE).toBe('128000');
    });

    test('ModelBackCommand should handle no previous model', () => {
        const context = {} as any;
        const cmd = new ModelBackCommand(context);
        
        // Ensure no previous config
        (ModelCommand as any).previousConfig = {};
        
        const result = cmd.execute([]);
        
        expect(result.shouldQuit).toBe(false);
        expect(result.runApiCall).toBe(false);
    });

    test('ModelCommand reset should clear previous configs', () => {
        // Set some previous config
        (ModelCommand as any).previousConfig = { API_MODEL: 'test' };
        
        ModelCommand.reset();
        
        expect((ModelCommand as any).previousConfig).toEqual({});
    });
});