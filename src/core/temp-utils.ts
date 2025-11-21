/**
 * Temporary file utilities for user-specific runtime directories
 */

import { existsSync, mkdirSync } from 'node:fs';
import { userInfo } from 'node:os';

export class TempUtils {
  static getTempDir(): string {
    // Get user ID
    const userId = userInfo().uid;
    
    // Create the directory path
    const tempDir = `/run/user/${userId}/tmp`;
    
    // Create directory if it doesn't exist
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
    
    return tempDir;
  }

  static createTempFile(prefix: string, suffix: string = ''): string {
    const tempDir = this.getTempDir();
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 10000);
    const fileName = `${prefix}-${timestamp}-${randomNum}${suffix}`;
    
    return `${tempDir}/${fileName}`;
  }
}