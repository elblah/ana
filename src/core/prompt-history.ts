import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Simple JSONL prompt history - compatible with Python version
 */
export class PromptHistory {
  private historyPath: string;

  constructor() {
    const aicoderDir = '.aicoder';
    this.historyPath = path.join(aicoderDir, 'history');
    
    // Ensure .aicoder directory exists
    if (!fs.existsSync(aicoderDir)) {
      fs.mkdirSync(aicoderDir, { recursive: true });
    }
  }

  /**
   * Save a prompt to history (JSONL format)
   */
  async savePrompt(prompt: string): Promise<void> {
    // Skip empty prompts and approval responses
    if (!prompt.trim() || prompt.match(/^[Yn]$/i)) {
      return;
    }

    // Only save prompt attribute for backward compatibility
    const entry = { prompt };
    const line = JSON.stringify(entry) + '\n';
    
    try {
      await fs.promises.appendFile(this.historyPath, line, 'utf8');
    } catch (error) {
      // Silent fail for history errors
    }
  }

  /**
   * Read all prompts from history (async)
   */
  async readHistory(): Promise<Array<{prompt: string}>> {
    try {
      if (!fs.existsSync(this.historyPath)) {
        return [];
      }

      const content = await fs.promises.readFile(this.historyPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      return lines.map(line => {
        try {
          const entry = JSON.parse(line);
          // Only return prompt attribute for backward compatibility
          return { prompt: entry.prompt || '' };
        } catch {
          return { prompt: '' };
        }
      }).filter(entry => entry.prompt !== '');
    } catch (error) {
      return [];
    }
  }

  /**
   * Read all prompts from history (sync for constructor)
   */
  readHistorySync(): Array<{prompt: string}> {
    try {
      if (!fs.existsSync(this.historyPath)) {
        return [];
      }

      const content = fs.readFileSync(this.historyPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      return lines.map(line => {
        try {
          const entry = JSON.parse(line);
          // Only return prompt attribute for backward compatibility
          return { prompt: entry.prompt || '' };
        } catch {
          return { prompt: '' };
        }
      }).filter(entry => entry.prompt !== '');
    } catch (error) {
      return [];
    }
  }
}