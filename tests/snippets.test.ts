import { describe, it, expect, vi, beforeEach } from 'bun:test';
import * as SnippetUtils from '../src/core/snippet-utils.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

vi.mock('node:fs');
vi.mock('node:path');
vi.mock('node:os');

describe('Snippet Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expands valid snippet', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('snippet content');
    const result = SnippetUtils.expandSnippets('Fix @@plan');
    expect(result).toBe('Fix snippet content');
    expect(fs.readFileSync).toHaveBeenCalled();
  });

  it('warns and keeps missing snippet', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = SnippetUtils.expandSnippets('@@missing');
    expect(result).toContain('@@missing');
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('[Snippet missing: @@missing'));
  });

  it('handles multiple nested', () => {
    vi.mocked(fs.readFileSync).mockReturnValueOnce('first').mockReturnValueOnce('second');
    const result = SnippetUtils.expandSnippets('@@a @@b');
    expect(result).toBe('first second');
  });

  it('lists names with .txt', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['plan.txt', 'build.txt']);
    const names = SnippetUtils.getSnippetNames();
    expect(names).toEqual(['build', 'plan']);
  });

  it('load tries .txt fallback', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.existsSync).mockReturnValueOnce(true); // name.txt
    vi.mocked(fs.readFileSync).mockReturnValue('content');
    const result = SnippetUtils.loadSnippet('plan');
    expect(result).toBe('content');
  });
});
