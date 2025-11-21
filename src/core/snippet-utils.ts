import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const SNIPPETS_DIR = path.join(os.homedir(), '.config/aicoder-mini/snippets');

export function ensureSnippetsDir(): void {
  if (!fs.existsSync(SNIPPETS_DIR)) {
    fs.mkdirSync(SNIPPETS_DIR, { recursive: true });
  }
}

export function loadSnippet(name: string): string | null {
  ensureSnippetsDir();
  // Try no-ext first, then .txt
  const paths = [
    path.join(SNIPPETS_DIR, name),
    path.join(SNIPPETS_DIR, `${name}.txt`)
  ];
  for (const filePath of paths) {
    if (fs.existsSync(filePath)) {
      try {
        return fs.readFileSync(filePath, 'utf8').trim();
      } catch (error) {
        // File exists but can't read - continue to next option
        console.warn(`Warning: Cannot read snippet file ${filePath}: ${error}`);
      }
    }
  }
  return null;
}

export function expandSnippets(input: string): string {
  let result = input;
  let changed = false;
  do {
    changed = false;
    result = result.replace(/@@([a-zA-Z0-9_-]+)/g, (match, name: string) => {
      const content = loadSnippet(name);
      if (content !== null) {
        changed = true;
        return content;
      } else {
        console.warn(`[Snippet missing: @@${name} → skipped]`);
        return match;  // Keep original
      }
    });
  } while (changed);
  return result;
}

export function getSnippetNames(): string[] {
  ensureSnippetsDir();
  try {
    const files = fs.readdirSync(SNIPPETS_DIR).filter(f => !f.startsWith('.'));
    const names = files.map(f => path.basename(f, '.txt')).filter(Boolean);
    // Dedup if both name and name.txt exist and sort once
    return Array.from(new Set(names)).sort();
  } catch (error) {
    console.warn(`Warning: Cannot read snippets directory: ${error}`);
    return [];
  }
}
