#!/usr/bin/env bun

/**
 * AI Coder - TypeScript implementation
 * Fast, lightweight AI-assisted development that runs anywhere
 */

import { AICoder } from './core/aicoder.js';

async function main(): Promise<void> {
    try {
        const app = new AICoder();
        await app.initialize();
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
