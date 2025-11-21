/**
 * Universal prompt builder system
 * Compatible with both Python and TypeScript implementations
 * Supports Python {variable} format and automatic AGENTS.md integration
 */

import { PromptContext, PromptOptions } from './interfaces.js';

export class PromptBuilder {
  private static defaultPromptTemplate: string;

  /**
   * Initialize the prompt builder by loading the default template
   */
  static async initialize(): Promise<void> {
    // Try relative path first (for development)
    let templatePath = 'src/prompts/default-system-prompt.md';
    
    try {
      const template = await Bun.file(templatePath).text();
      this.defaultPromptTemplate = template;
      return;
    } catch (error) {
      // If relative path fails, try absolute path from script location
      const scriptDir = new URL('.', import.meta.url).pathname;
      templatePath = `${scriptDir}default-system-prompt.md`;
      const template = await Bun.file(templatePath).text();
      this.defaultPromptTemplate = template;
    }
  }

  /**
   * Build the complete system prompt from template and context
   */
  static buildPrompt(context: PromptContext, options?: PromptOptions): string {
    // Use override if provided, otherwise use default template
    let prompt = options?.overridePrompt || this.defaultPromptTemplate;
    
    // Normalize template format to Python {variable} style
    if (prompt.includes('${')) {
      prompt = prompt.replace(/\$\{([^}]+)\}/g, '{$1}');
    }
    
    // Replace Python-compatible variables
    prompt = prompt.replace(/{current_directory}/g, context.currentDirectory);
    prompt = prompt.replace(/{current_datetime}/g, context.currentDatetime);
    prompt = prompt.replace(/{system_info}/g, context.systemInfo);
    
    // Handle {available_tools} - for now include basic info since tools come via API
    const availableToolsInfo = this.getAvailableToolsInfo();
    prompt = prompt.replace(/{available_tools}/g, availableToolsInfo);
    
    // Replace agents content if variable exists
    prompt = prompt.replace(/{agents_content}/g, context.agentsContent || '');
    
    // Smart AGENTS.md handling for overrides (Option 2)
    if (options?.overridePrompt && context.agentsContent) {
      const hasAgentsVar = prompt.includes('{agents_content}') || 
                          prompt.includes('<project_specific_instructions>');
      
      if (!hasAgentsVar) {
        // Append AGENTS.md with proper structure
        const cleanAgents = context.agentsContent.replace(/^\n\n---\n\n/, '');
        prompt += '\n\n<project_specific_instructions>\n' + cleanAgents + '\n</project_specific_instructions>';
        console.log('[i] Appended AGENTS.md to PROMPT-OVERRIDE.md');
      }
    }
    
    return prompt;
  }

  /**
   * Load PROMPT-OVERRIDE.md content if it exists
   */
  static async loadPromptOverride(): Promise<string | null> {
    try {
      const file = Bun.file('PROMPT-OVERRIDE.md');
      if (await file.exists()) {
        console.log('[i] Using PROMPT-OVERRIDE.md as system prompt');
        return await file.text();
      }
    } catch (error) {
      // Silently ignore if PROMPT-OVERRIDE.md doesn't exist or can't be read
    }
    return null;
  }

  /**
   * Load AGENTS.md content if it exists
   */
  static async loadAgentsContent(): Promise<string | null> {
    try {
      const file = Bun.file('AGENTS.md');
      if (await file.exists()) {
        return '\n\n---\n\n' + await file.text();
      }
    } catch (error) {
      // Silently ignore if AGENTS.md doesn't exist or can't be read
    }
    return null;
  }

  /**
   * Get basic available tools information
   * Since tools are provided via API request, this is minimal info
   */
  private static getAvailableToolsInfo(): string {
    return `Basic tools available: file operations (read, write, list), 
search (grep), shell command execution, and more via API request.`;
  }

  /**
   * Get system information for template
   */
  static getSystemInfo(): string {
    const os = process.platform;
    const arch = process.arch;
    const nodeVersion = process.version;
    
    return `Platform: ${os} (${arch}), Node.js: ${nodeVersion}`;
  }
}