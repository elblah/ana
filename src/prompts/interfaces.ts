/**
 * Interfaces for universal prompt building system
 * Compatible with both Python and TypeScript implementations
 */

export interface PromptContext {
  agentsContent?: string;      // Maps to {agents_content}
  currentDirectory: string;     // Maps to {current_directory}
  currentDatetime: string;       // Maps to {current_datetime}
  systemInfo: string;          // Maps to {system_info}
}

export interface PromptOptions {
  overridePrompt?: string;  // PROMPT-OVERRIDE.md content
}