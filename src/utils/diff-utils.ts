/**
 * Diff utilities for generating file differences
 */

import { ShellUtils } from './shell-utils.js';

export class DiffUtils {
    /**
     * Generate unified diff between two files
     */
    static generateUnifiedDiff(oldPath: string, newPath: string): string {
        const result = ShellUtils.executeCommandSync(`diff -u "${oldPath}" "${newPath}"`);

        if (result.success) {
            return result.stdout || 'No changes - content is identical';
        } else if (result.exitCode === 1) {
            // diff returns 1 when differences are found
            return result.stdout || 'Differences found (no output)';
        } else {
            return `Error generating diff: ${result.stderr}`;
        }
    }

    /**
     * Generate unified diff and return whether changes were detected
     */
    static generateUnifiedDiffWithStatus(
        oldPath: string,
        newPath: string
    ): { diff: string; hasChanges: boolean } {
        const result = ShellUtils.executeCommandSync(`diff -u "${oldPath}" "${newPath}"`);

        if (result.success) {
            return { diff: result.stdout || 'No changes - content is identical', hasChanges: false };
        } else if (result.exitCode === 1) {
            // diff returns 1 when differences are found
            return { diff: result.stdout || 'Differences found (no output)', hasChanges: true };
        } else {
            const errorContent = `Error generating diff: ${result.stderr}`;
            return { diff: errorContent, hasChanges: false };
        }
    }
}
