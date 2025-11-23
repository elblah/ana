/**
 * Markdown colorization component for streaming responses.
 * Handles colorized output of markdown content with proper state management.
 * Ported EXACTLY from Python's streaming_colorizer.py
 */

import { Config } from './config.js';

export class MarkdownColorizer {
    private _inCode = false;
    private _codeTickCount = 0;
    private _inStar = false;
    private _starCount = 0;
    private _atLineStart = true;
    private _inHeader = false;
    private _inBold = false;
    private _consecutiveCount = 0;
    private _canBeBold = false;

    constructor() {
        this.resetState();
    }

    resetState(): void {
        this._inCode = false;
        this._codeTickCount = 0;
        this._inStar = false;
        this._starCount = 0;
        this._atLineStart = true;
        this._inHeader = false;
        this._inBold = false;
        this._consecutiveCount = 0;
        this._canBeBold = false;
    }

    printWithColorization(content: string): string {
        if (!content) {
            return content;
        }

        let result = '';
        let i = 0;

        while (i < content.length) {
            const char = content[i];

            // Handle consecutive asterisk counting
            if (char === '*') {
                this._consecutiveCount++;
                // Only allow bold for exactly 2 asterisks, not 3+
                if (this._consecutiveCount === 2) {
                    this._canBeBold = true;
                } else if (this._consecutiveCount > 2) {
                    this._canBeBold = false;
                }
            } else {
                this._consecutiveCount = 0;
            }

            // Handle newlines - reset line start and any active modes
            if (char === '\n') {
                this._atLineStart = true;
                // Reset header mode
                if (this._inHeader) {
                    result += Config.colors.reset;
                    this._inHeader = false;
                }
                // Reset star mode on newline
                if (this._inStar) {
                    result += Config.colors.reset;
                    this._inStar = false;
                    this._starCount = 0;
                }
                // Reset bold mode on newline
                if (this._inBold) {
                    result += Config.colors.reset;
                    this._inBold = false;
                }
                // Reset can_be_bold on newline
                this._canBeBold = false;
                result += char;
                i++;
                continue;
            }

            // Precedence 1: If we're in code mode, only look for closing backticks
            if (this._inCode) {
                result += char;
                if (char === '`') {
                    this._codeTickCount--;
                    if (this._codeTickCount === 0) {
                        result += Config.colors.reset;
                        this._inCode = false;
                    }
                }
                i++;
                continue;
            }

            // Precedence 2: If we're in star mode, keep current formatting and look for closing stars
            if (this._inStar) {
                result += char; // Keep current formatting (like Python)
                if (char === '*') {
                    this._starCount--;
                    if (this._starCount === 0) {
                        // Reset everything at the end of star sequence
                        result += Config.colors.reset;
                        this._inStar = false;

                        // Handle bold mode toggle
                        if (this._canBeBold) {
                            if (this._inBold) {
                                this._inBold = false;
                            } else {
                                this._inBold = true;
                                // Apply bold after reset (like Python)
                                result += Config.colors.bold;
                            }
                        }

                        // Reset counters when sequence ends
                        this._consecutiveCount = 0;
                        this._canBeBold = false;
                    }
                }
                i++;
                continue;
            }

            // Precedence 3: Check for backticks (highest precedence)
            if (char === '`') {
                // Count consecutive backticks
                let tickCount = 0;
                let j = i;
                while (j < content.length && content[j] === '`') {
                    tickCount++;
                    j++;
                }

                // Start code block
                result += Config.colors.green;
                for (let k = 0; k < tickCount; k++) {
                    result += '`';
                }
                this._inCode = true;
                this._codeTickCount = tickCount;
                this._atLineStart = false;
                i += tickCount;
                continue;
            }

            // Precedence 4: Check for asterisks (medium precedence)
            if (char === '*') {
                // Count consecutive asterisks
                let starCount = 0;
                let j = i;
                while (j < content.length && content[j] === '*') {
                    starCount++;
                    j++;
                }

                // Start star block with GREEN + BOLD (correct order like Python)
                result += Config.colors.green + Config.colors.bold;
                for (let k = 0; k < starCount; k++) {
                    result += '*';
                }

                this._inStar = true;
                this._starCount = starCount;
                this._atLineStart = false;
                i += starCount;
                continue;
            }

            // Precedence 5: Check for header # at line start (lowest precedence)
            if (this._atLineStart && char === '#') {
                result += Config.colors.red;
                this._inHeader = true;
                result += char;
                this._atLineStart = false;
                i++;
                continue;
            }

            // Regular character
            result += char;
            this._atLineStart = false;
            i++;
        }

        return result;
    }

    processWithColorization(content: string): string {
        return this.printWithColorization(content);
    }
}
