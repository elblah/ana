/**
 * Stream utilities for reading input/output
 */

export class StreamUtils {
    /**
     * Read all content from stdin and return as trimmed string
     */
    static async readStdinAsString(): Promise<string> {
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks).toString('utf8').trim();
    }
}
