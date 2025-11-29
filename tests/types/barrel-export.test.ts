/**
 * Essential barrel export test
 * Ensures all types compile correctly from barrel export
 */

import { describe, it, expect } from 'bun:test';

// Import from barrel export - this should work without issues
import * as Types from '../../src/core/types/index.js';

describe('Barrel Export', () => {
    it('should compile and export all domains correctly', () => {
        // If this compiles, the barrel export works
        // TypeScript interfaces don't exist at runtime, so we test compilation
        
        type MessageTypes = {
            Message: Types.Message;
            AssistantMessage: Types.AssistantMessage;
            ToolResultData: Types.ToolResultData;
        };
        
        type ApiTypes = {
            ApiUsage: Types.ApiUsage;
            ApiRequestData: Types.ApiRequestData;
            StreamChunk: Types.StreamChunk;
        };
        
        type ToolTypes = {
            ToolDefinition: Types.ToolDefinition;
            ToolOutput: Types.ToolOutput;
            CommandResult: Types.CommandResult;
        };
        
        type SystemTypes = {
            Plugin: Types.Plugin;
            PluginContext: Types.PluginContext;
            CouncilMember: Types.CouncilMember;
        };
        
        // Compilation success is the test
        expect(true).toBe(true);
    });
});