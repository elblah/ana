#!/usr/bin/env bun

/**
 * AI Coder - TypeScript implementation
 * Fast, lightweight AI-assisted development that runs anywhere
 */

import { AICoder } from './core/aicoder.js';
import { Config } from './core/config.js';

async function main(): Promise<void> {
    const startTime = Date.now();
    
    try {
        // Check if running in interactive terminal
        if (!process.stdin.isTTY) {
            console.error('Error: AI Coder requires an interactive terminal.');
            console.error('Usage: bun src/index.ts');
            process.exit(1);
        }

        const app = new AICoder();
        await app.initialize();
        
        if (Config.debug) {
            const initTime = Date.now() - startTime;
            console.log(`[DEBUG] Initialization time: ${initTime}ms`);
        }
        
        await app.run();
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// SIGINT is handled by AICoder class to allow interrupting AI responses

// Run the application
if (import.meta.main) {
    main().catch((error) => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}
