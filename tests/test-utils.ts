/**
 * Test Utilities - Centralized test cleanup and utilities
 * 
 * Prevents test pollution by using temporary directories consistently
 * and providing proper cleanup mechanisms
 */

import * as path from 'node:path';
import { FileUtils } from '../src/utils/file-utils.js';
import { ShellUtils } from '../src/utils/shell-utils.js';

export class TestEnvironment {
    private static testCounter = 0;
    
    /**
     * Get a unique temporary directory for each test
     * Uses project root tmp directory to organize test files properly
     */
    static getTempDir(): string {
        const testId = ++TestEnvironment.testCounter;
        // Use dedicated tmp directory in project root for organization
        // Tools are sandboxed to current directory, so temp dirs must be inside project
        const basePath = process.cwd();
        return `${basePath}/tmp/test-temp-${testId}-${Date.now()}`;
    }
    
    /**
     * Setup test environment with clean state
     */
    static async setup(clearFileTracking: boolean = true): Promise<string> {
        // Always reset all static state to prevent test interference
        // This is critical for test isolation - even tests that don't need tracking
        // must clear state to prevent interference with other tests
        FileUtils.resetAllState();
        
        // Create unique temp directory
        const tempDir = this.getTempDir();
        try {
            // Ensure the base tmp directory exists first
            const baseTmpDir = path.resolve(process.cwd(), 'tmp');
            await ShellUtils.executeCommand(`mkdir -p ${baseTmpDir}`);
            
            // Create test-specific subdirectory
            await ShellUtils.executeCommand(`mkdir -p ${tempDir}`);
        } catch (error) {
            throw new Error(`Failed to create temp directory ${tempDir}: ${error}`);
        }
        
        return tempDir;
    }
    
    /**
     * Cleanup test environment
     */
    static async cleanup(tempDir: string): Promise<void> {
        try {
            await ShellUtils.executeCommand(`rm -rf ${tempDir}`);
        } catch {
            // Ignore cleanup errors
        }
        
        // Also try to cleanup the base tmp directory if it's empty
        try {
            const baseTmpDir = path.resolve(process.cwd(), 'tmp');
            await ShellUtils.executeCommand(`rmdir ${baseTmpDir} 2>/dev/null || true`);
        } catch {
            // Ignore cleanup errors
        }
        
        // Always reset all static state after cleanup
        // This ensures no test interferes with subsequent tests
        FileUtils.resetAllState();
    }
    
    /**
     * Run a test with automatic setup and cleanup
     */
    static async withTempDir<T>(testFn: (tempDir: string) => Promise<T>): Promise<T> {
        const tempDir = await this.setup();
        try {
            return await testFn(tempDir);
        } finally {
            await this.cleanup(tempDir);
        }
    }
}

// Re-export ShellUtils for convenience
export { ShellUtils } from '../src/utils/shell-utils.js';