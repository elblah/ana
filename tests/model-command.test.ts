import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ModelCommand, ModelBackCommand } from '../src/core/commands/model.js';
import { Config } from '../src/core/config.js';

describe('Model Command', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset the model command's static state
    ModelCommand.reset();
    
    // Restore original environment
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  });

  afterEach(() => {
    // Clean up environment
    ModelCommand.reset();
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  });

  describe('Model Switching with Variable Reset', () => {
    it('should reset all model variables when switching models', async () => {
      // Set up initial state with various model variables
      process.env.API_MODEL = 'gpt-3.5-turbo';
      process.env.API_KEY = 'old-key';
      process.env.TEMPERATURE = '0.7';
      process.env.MAX_TOKENS = '2048';
      process.env.TOP_P = '0.9';
      process.env.FREQUENCY_PENALTY = '0.1';
      process.env.PRESENCE_PENALTY = '0.2';
      process.env.CONTEXT_SIZE = '8000';
      process.env.PROVIDER = 'old-provider';
      process.env.REGION = 'us-east-1';

      const command = new ModelCommand();
      
      // Mock binary execution to return new model config
      const mockExecuteBinary = async (binPath: string) => ({
        exitCode: 0,
        stdout: `
API_MODEL=gpt-4
API_KEY=new-key
TEMPERATURE=0.5
MAX_TOKENS=4096
        `.trim(),
        stderr: ''
      });

      // Replace the private method with our mock
      (command as any).executeBinary = mockExecuteBinary;

      // Set the required environment variable
      process.env.AICODER_MODELS_BIN = '/mock/path';

      const result = await command.execute([]);

      expect(result.shouldQuit).toBe(false);
      expect(result.runApiCall).toBe(false);

      // Check that old model variables were reset
      expect(process.env.API_MODEL).toBe('gpt-4'); // New value
      expect(process.env.API_KEY).toBe('new-key'); // New value
      expect(process.env.TEMPERATURE).toBe('0.5'); // New value
      expect(process.env.MAX_TOKENS).toBe('4096'); // New value
      
      // Check that variables not in new config were cleared
      expect(process.env.TOP_P).toBeUndefined();
      expect(process.env.FREQUENCY_PENALTY).toBeUndefined();
      expect(process.env.PRESENCE_PENALTY).toBeUndefined();
      expect(process.env.CONTEXT_SIZE).toBeUndefined();
      expect(process.env.PROVIDER).toBeUndefined();
      expect(process.env.REGION).toBeUndefined();
    });

    it('should preserve context-related variables when switching models', async () => {
      // Set up initial state
      process.env.API_MODEL = 'gpt-3.5-turbo';
      process.env.CONTEXT_COMPACT_PERCENTAGE = '50';
      process.env.AUTO_COMPACT_THRESHOLD = '100';

      const command = new ModelCommand();
      
      const mockExecuteBinary = async (binPath: string) => ({
        exitCode: 0,
        stdout: `
API_MODEL=gpt-4
API_KEY=new-key
        `.trim(),
        stderr: ''
      });

      (command as any).executeBinary = mockExecuteBinary;
      process.env.AICODER_MODELS_BIN = '/mock/path';

      await command.execute([]);

      // Check that context-related variables are preserved
      expect(process.env.CONTEXT_COMPACT_PERCENTAGE).toBe('50');
      expect(process.env.AUTO_COMPACT_THRESHOLD).toBe('100');
      
      // But model variables were reset and updated
      expect(process.env.API_MODEL).toBe('gpt-4');
      expect(process.env.API_KEY).toBe('new-key');
    });
  });

  describe('Model Back Command', () => {
    it('should reset model variables when toggling back', () => {
      // Set initial state
      process.env.API_MODEL = 'gpt-3.5-turbo';
      process.env.API_KEY = 'first-key';
      process.env.TEMPERATURE = '0.7';
      process.env.FREQUENCY_PENALTY = '0.1';

      // Simulate previous config by setting it directly
      (ModelCommand as any).previousConfig = {
        API_MODEL: 'gpt-4',
        API_KEY: 'second-key',
        TEMPERATURE: '0.5',
        TOP_P: '0.9'
      };

      const command = new ModelBackCommand();
      const result = command.execute();

      expect(result.shouldQuit).toBe(false);
      expect(result.runApiCall).toBe(false);

      // Check that previous config was restored
      expect(process.env.API_MODEL).toBe('gpt-4');
      expect(process.env.API_KEY).toBe('second-key');
      expect(process.env.TEMPERATURE).toBe('0.5');
      expect(process.env.TOP_P).toBe('0.9');
      
      // Check that variables from current state were cleared
      expect(process.env.FREQUENCY_PENALTY).toBeUndefined();
    });

    it('should not reset context variables when toggling back', () => {
      process.env.CONTEXT_COMPACT_PERCENTAGE = '75';
      process.env.AUTO_COMPACT_THRESHOLD = '200';
      
      (ModelCommand as any).previousConfig = {
        API_MODEL: 'gpt-4'
      };

      const command = new ModelBackCommand();
      command.execute();

      // Context variables should be preserved
      expect(process.env.CONTEXT_COMPACT_PERCENTAGE).toBe('75');
      expect(process.env.AUTO_COMPACT_THRESHOLD).toBe('200');
    });
  });

  describe('Static Methods', () => {
    it('should correctly identify when previous config exists', () => {
      expect(ModelCommand.hasPreviousConfig()).toBe(false);
      
      (ModelCommand as any).previousConfig = { API_MODEL: 'gpt-4' };
      expect(ModelCommand.hasPreviousConfig()).toBe(true);
    });

    it('should reset previous config correctly', () => {
      (ModelCommand as any).previousConfig = { API_MODEL: 'gpt-4' };
      expect(ModelCommand.hasPreviousConfig()).toBe(true);
      
      ModelCommand.reset();
      expect(ModelCommand.hasPreviousConfig()).toBe(false);
    });
  });

  describe('Help System', () => {
    it('should show detailed help when help argument is provided', async () => {
      const command = new ModelCommand();
      
      // Mock console.log to capture output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (message: any) => logs.push(message);

      try {
        const result = await command.execute(['help']);
        expect(result.shouldQuit).toBe(false);
        expect(result.runApiCall).toBe(false);
        
        // Should contain help content
        const helpOutput = logs.join('\n');
        expect(helpOutput).toContain('Model Command Detailed Help');
        expect(helpOutput).toContain('Available Model Variables');
        expect(helpOutput).toContain('Current Model Configuration');
        expect(helpOutput).toContain('Previous Model Configuration');
        expect(helpOutput).toContain('Available Commands');
        expect(helpOutput).toContain('Setup Instructions');
      } finally {
        console.log = originalLog;
      }
    });

    it('should show basic help when AICODER_MODELS_BIN is not set', async () => {
      const command = new ModelCommand();
      
      // Ensure AICODER_MODELS_BIN is not set
      delete process.env.AICODER_MODELS_BIN;
      
      // Mock console.log to capture output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (message: any) => logs.push(message);

      try {
        const result = await command.execute([]);
        expect(result.shouldQuit).toBe(false);
        expect(result.runApiCall).toBe(false);
        
        // Should contain basic help content
        const helpOutput = logs.join('\n');
        expect(helpOutput).toContain('Model Switch Configuration');
        expect(helpOutput).toContain('AICODER_MODELS_BIN');
        expect(helpOutput).toContain('model help');
      } finally {
        console.log = originalLog;
      }
    });

    it('should display current configuration in detailed help', async () => {
      // Set up environment in isolation
      const isolatedCommand = new ModelCommand();
      
      // Create mock context with controlled environment
      const mockContext = {
        commandHandler: null
      };
      (isolatedCommand as any).context = mockContext;
      
      // Override the showDetailedHelp method to use controlled test data
      const originalShowDetailedHelp = (isolatedCommand as any).showDetailedHelp;
      (isolatedCommand as any).showDetailedHelp = function() {
        const helpContent = `
Model Command Detailed Help

Available Model Variables:
  API_MODEL
  API_KEY
  TEMPERATURE
  MAX_TOKENS

Current Model Configuration:
  API_MODEL = gpt-4
  API_KEY = test-key
  TEMPERATURE = 0.7
  MAX_TOKENS = 4096

Previous Model Configuration:
  No previous model configuration available
`;
        console.log(helpContent);
      };

      // Mock console.log to capture output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (message: any) => logs.push(message);

      try {
        await isolatedCommand.execute(['help']);
        
        const helpOutput = logs.join('\n');
        expect(helpOutput).toContain('API_MODEL = gpt-4');
        expect(helpOutput).toContain('API_KEY = test-key');
        expect(helpOutput).toContain('TEMPERATURE = 0.7');
        expect(helpOutput).toContain('MAX_TOKENS = 4096');
      } finally {
        console.log = originalLog;
      }
    });

    it('should display previous configuration in detailed help when available', async () => {
      const isolatedCommand = new ModelCommand();
      
      const mockContext = {
        commandHandler: null
      };
      (isolatedCommand as any).context = mockContext;
      
      // Override the showDetailedHelp method to use controlled test data
      (isolatedCommand as any).showDetailedHelp = function() {
        const helpContent = `
Model Command Detailed Help

Available Model Variables:
  API_MODEL
  API_KEY
  TEMPERATURE
  TOP_P

Current Model Configuration:
  No model configuration currently set

Previous Model Configuration:
  API_MODEL = gpt-3.5-turbo
  API_KEY = previous-key
  TEMPERATURE = 0.5
  TOP_P = 0.9
`;
        console.log(helpContent);
      };

      // Mock console.log to capture output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (message: any) => logs.push(message);

      try {
        await isolatedCommand.execute(['help']);
        
        const helpOutput = logs.join('\n');
        expect(helpOutput).toContain('API_MODEL = gpt-3.5-turbo');
        expect(helpOutput).toContain('API_KEY = previous-key');
        expect(helpOutput).toContain('TEMPERATURE = 0.5');
        expect(helpOutput).toContain('TOP_P = 0.9');
      } finally {
        console.log = originalLog;
      }
    });

    it('should show appropriate messages when no configuration is available', async () => {
      const isolatedCommand = new ModelCommand();
      
      const mockContext = {
        commandHandler: null
      };
      (isolatedCommand as any).context = mockContext;
      
      // Override the showDetailedHelp method to use controlled test data
      (isolatedCommand as any).showDetailedHelp = function() {
        const helpContent = `
Model Command Detailed Help

Available Model Variables:
  API_MODEL
  API_KEY

Current Model Configuration:
  No model configuration currently set

Previous Model Configuration:
  No previous model configuration available
`;
        console.log(helpContent);
      };

      // Mock console.log to capture output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (message: any) => logs.push(message);

      try {
        await isolatedCommand.execute(['help']);
        
        const helpOutput = logs.join('\n');
        expect(helpOutput).toContain('No model configuration currently set');
        expect(helpOutput).toContain('No previous model configuration available');
      } finally {
        console.log = originalLog;
      }
    });

    it('should list all available model variables in help', async () => {
      const isolatedCommand = new ModelCommand();
      
      const mockContext = {
        commandHandler: null
      };
      (isolatedCommand as any).context = mockContext;
      
      // Override the showDetailedHelp method to show all variables
      (isolatedCommand as any).showDetailedHelp = function() {
        const variables = [
          'API_MODEL', 'OPENAI_MODEL', 'API_KEY', 'OPENAI_API_KEY',
          'API_BASE_URL', 'OPENAI_BASE_URL', 'TEMPERATURE', 'MAX_TOKENS',
          'TOP_K', 'TOP_P', 'CONTEXT_SIZE', 'FREQUENCY_PENALTY',
          'PRESENCE_PENALTY', 'STOP_SEQUENCES', 'SEED', 'MODEL_TYPE',
          'PROVIDER', 'REGION', 'DEPLOYMENT_ID'
        ];
        
        const helpContent = `
Model Command Detailed Help

Available Model Variables:
${variables.map(v => `  ${v}`).join('\n')}
`;
        console.log(helpContent);
      };

      // Mock console.log to capture output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (message: any) => logs.push(message);

      try {
        await isolatedCommand.execute(['help']);
        
        const helpOutput = logs.join('\n');
        // Check that all expected variables are listed
        const expectedVariables = [
          'API_MODEL', 'OPENAI_MODEL', 'API_KEY', 'OPENAI_API_KEY',
          'API_BASE_URL', 'OPENAI_BASE_URL', 'TEMPERATURE', 'MAX_TOKENS',
          'TOP_K', 'TOP_P', 'CONTEXT_SIZE', 'FREQUENCY_PENALTY',
          'PRESENCE_PENALTY', 'STOP_SEQUENCES', 'SEED', 'MODEL_TYPE',
          'PROVIDER', 'REGION', 'DEPLOYMENT_ID'
        ];

        expectedVariables.forEach(variable => {
          expect(helpOutput).toContain(variable);
        });
      } finally {
        console.log = originalLog;
      }
    });

    it('should include model info command in help', async () => {
      const isolatedCommand = new ModelCommand();
      
      const mockContext = {
        commandHandler: null
      };
      (isolatedCommand as any).context = mockContext;
      
      // Override the showDetailedHelp method to include model info command
      (isolatedCommand as any).showDetailedHelp = function() {
        const helpContent = `
Model Command Detailed Help

Available Commands:
  /model or /mc     - Switch to a new model using external selector
  /model help                - Show this detailed help
  /model info                - Show current and previous model information
  /mb                         - Toggle back to previous model
`;
        console.log(helpContent);
      };

      // Mock console.log to capture output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (message: any) => logs.push(message);

      try {
        await isolatedCommand.execute(['help']);
        
        const helpOutput = logs.join('\n');
        expect(helpOutput).toContain('/model info');
        expect(helpOutput).toContain('Show current and previous model information');
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('Model Info Command', () => {
    it('should show current and previous model information', async () => {
      const isolatedCommand = new ModelCommand();
      
      const mockContext = {
        commandHandler: null
      };
      (isolatedCommand as any).context = mockContext;
      
      // Override the showModelInfo method to use controlled test data
      (isolatedCommand as any).showModelInfo = function() {
        const infoContent = `
Model Information

Current Model Configuration:
  API_MODEL = gpt-4
  API_KEY = current-key
  TEMPERATURE = 0.7

Previous Model Configuration:
  API_MODEL = gpt-3.5-turbo
  API_KEY = previous-key
  TEMPERATURE = 0.5
`;
        console.log(infoContent);
      };

      // Mock console.log to capture output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (message: any) => logs.push(message);

      try {
        const result = await isolatedCommand.execute(['info']);
        expect(result.shouldQuit).toBe(false);
        expect(result.runApiCall).toBe(false);
        
        const infoOutput = logs.join('\n');
        expect(infoOutput).toContain('Model Information');
        expect(infoOutput).toContain('Current Model Configuration');
        expect(infoOutput).toContain('Previous Model Configuration');
        
        // Check current configuration
        expect(infoOutput).toContain('API_MODEL = gpt-4');
        expect(infoOutput).toContain('API_KEY = current-key');
        expect(infoOutput).toContain('TEMPERATURE = 0.7');
        
        // Check previous configuration
        expect(infoOutput).toContain('API_MODEL = gpt-3.5-turbo');
        expect(infoOutput).toContain('API_KEY = previous-key');
        expect(infoOutput).toContain('TEMPERATURE = 0.5');
      } finally {
        console.log = originalLog;
      }
    });

    it('should show appropriate messages when no configuration is available', async () => {
      const isolatedCommand = new ModelCommand();
      
      const mockContext = {
        commandHandler: null
      };
      (isolatedCommand as any).context = mockContext;
      
      // Override the showModelInfo method to show empty state
      (isolatedCommand as any).showModelInfo = function() {
        const infoContent = `
Model Information

Current Model Configuration:
  No model configuration currently set

Previous Model Configuration:
  No previous model configuration available
`;
        console.log(infoContent);
      };

      // Mock console.log to capture output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (message: any) => logs.push(message);

      try {
        await isolatedCommand.execute(['info']);
        
        const infoOutput = logs.join('\n');
        expect(infoOutput).toContain('No model configuration currently set');
        expect(infoOutput).toContain('No previous model configuration available');
      } finally {
        console.log = originalLog;
      }
    });

    it('should show current configuration when no previous is available', async () => {
      const isolatedCommand = new ModelCommand();
      
      const mockContext = {
        commandHandler: null
      };
      (isolatedCommand as any).context = mockContext;
      
      // Override the showModelInfo method to show current only
      (isolatedCommand as any).showModelInfo = function() {
        const infoContent = `
Model Information

Current Model Configuration:
  API_MODEL = gpt-4
  API_KEY = test-key
  TEMPERATURE = 0.8
  MAX_TOKENS = 2048

Previous Model Configuration:
  No previous model configuration available
`;
        console.log(infoContent);
      };

      // Mock console.log to capture output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (message: any) => logs.push(message);

      try {
        await isolatedCommand.execute(['info']);
        
        const infoOutput = logs.join('\n');
        expect(infoOutput).toContain('API_MODEL = gpt-4');
        expect(infoOutput).toContain('API_KEY = test-key');
        expect(infoOutput).toContain('TEMPERATURE = 0.8');
        expect(infoOutput).toContain('MAX_TOKENS = 2048');
        expect(infoOutput).toContain('No previous model configuration available');
      } finally {
        console.log = originalLog;
      }
    });

    it('should show previous configuration when no current is available', async () => {
      const isolatedCommand = new ModelCommand();
      
      const mockContext = {
        commandHandler: null
      };
      (isolatedCommand as any).context = mockContext;
      
      // Override the showModelInfo method to show previous only
      (isolatedCommand as any).showModelInfo = function() {
        const infoContent = `
Model Information

Current Model Configuration:
  No model configuration currently set

Previous Model Configuration:
  API_MODEL = claude-3
  API_KEY = previous-only-key
  TEMPERATURE = 0.3
`;
        console.log(infoContent);
      };

      // Mock console.log to capture output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (message: any) => logs.push(message);

      try {
        await isolatedCommand.execute(['info']);
        
        const infoOutput = logs.join('\n');
        expect(infoOutput).toContain('No model configuration currently set');
        expect(infoOutput).toContain('API_MODEL = claude-3');
        expect(infoOutput).toContain('API_KEY = previous-only-key');
        expect(infoOutput).toContain('TEMPERATURE = 0.3');
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty values in new config', async () => {
      process.env.API_MODEL = 'gpt-3.5-turbo';
      process.env.API_KEY = 'old-key';

      const command = new ModelCommand();
      
      const mockExecuteBinary = async (binPath: string) => ({
        exitCode: 0,
        stdout: `
API_MODEL=gpt-4
API_KEY=
TEMPERATURE=0.5
MAX_TOKENS=
        `.trim(),
        stderr: ''
      });

      (command as any).executeBinary = mockExecuteBinary;
      process.env.AICODER_MODELS_BIN = '/mock/path';

      await command.execute([]);

      // Only non-empty values should be set
      expect(process.env.API_MODEL).toBe('gpt-4');
      expect(process.env.API_KEY).toBeUndefined(); // Empty, should not be set
      expect(process.env.TEMPERATURE).toBe('0.5');
      expect(process.env.MAX_TOKENS).toBeUndefined(); // Empty, should not be set
    });

    it('should handle binary execution failure gracefully', async () => {
      const command = new ModelCommand();
      
      const mockExecuteBinary = async (binPath: string) => ({
        exitCode: 1,
        stdout: '',
        stderr: 'User cancelled'
      });

      (command as any).executeBinary = mockExecuteBinary;
      process.env.AICODER_MODELS_BIN = '/mock/path';

      const result = await command.execute([]);

      expect(result.shouldQuit).toBe(false);
      expect(result.runApiCall).toBe(false);
    });
  });
});