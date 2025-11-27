/**
 * Council Service - Expert opinion system using AI Processor
 * Provides council reviews of AI work using file-based member definitions
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Message } from './message-history.js';
import { AIProcessor } from './ai-processor.js';
import { LogUtils } from '../utils/log-utils.js';
import { Config } from './config.js';

/**
 * Council member definition
 */
export interface CouncilMember {
    name: string;
    prompt: string;
}

/**
 * Council session state
 */
export interface CouncilSession {
    originalMessages: Message[];
    opinions: Map<string, string>;
    currentMember?: string;
    finalPlan?: string | null;
    consensusAchieved: boolean;
}

/**
 * Council service for expert opinions
 */
export class CouncilService {
    private processor: AIProcessor;
    private session: CouncilSession | null = null;

    constructor(processor: AIProcessor) {
        this.processor = processor;
    }

    /**
     * Start a new council session
     */
    async startSession(messages: Message[]): Promise<void> {
        this.session = {
            originalMessages: [...messages],
            opinions: new Map(),
            consensusAchieved: false
        };

        LogUtils.print('🏛️ Council session started', { color: Config.colors.cyan });
        LogUtils.print(`📋 Backing up conversation context...`, { color: Config.colors.cyan });
    }

    /**
     * Load council members from filesystem with optional filtering
     */
    async loadMembers(filters?: string[]): Promise<{ members: CouncilMember[], moderator: CouncilMember | null }> {
        const councilDir = path.join(os.homedir(), '.config/aicoder-mini/council');
        
        if (!fs.existsSync(councilDir)) {
            LogUtils.error('🏛️ Council not configured');
            LogUtils.print('');
            LogUtils.print('Council directory not found:', { color: Config.colors.yellow });
            LogUtils.print(`  ${councilDir}`);
            LogUtils.print('');
            LogUtils.print('To setup council:', { color: Config.colors.cyan });
            LogUtils.print('  mkdir -p ~/.config/aicoder-mini/council');
            LogUtils.print('');
            LogUtils.print('Example council members:', { color: Config.colors.yellow });
            LogUtils.print('  echo "You are a Simplicity Advocate..." > ~/.config/aicoder-mini/council/simplicity_advocate.txt');
            LogUtils.print('  echo "You are a Security Expert..." > ~/.config/aicoder-mini/council/security_expert.txt');
            LogUtils.print('  echo "You are a Council Moderator..." > ~/.config/aicoder-mini/council/moderator.txt');
            
            return { members: [], moderator: null };
        }

        const files = fs.readdirSync(councilDir).filter(f => f.endsWith('.txt'));
        const members: CouncilMember[] = [];
        let moderator: CouncilMember | null = null;

        for (const file of files) {
            const name = file.replace('.txt', '');
            
            try {
                const content = fs.readFileSync(path.join(councilDir, file), 'utf-8').trim();
                
                if (content.length === 0) {
                    LogUtils.warn(`Empty council member file: ${file}`);
                    continue;
                }

                // Moderator is always included regardless of filters
                if (name.includes('moderator')) {
                    moderator = { name, prompt: content };
                    continue;
                }
                
                // Apply filters to regular members
                if (filters && filters.length > 0) {
                    const matches = filters.some(keyword => name.includes(keyword));
                    if (!matches) continue;
                }

                members.push({ name, prompt: content });
            } catch (error) {
                LogUtils.warn(`Failed to load council member ${file}: ${error}`);
            }
        }

        LogUtils.print(`✓ Found ${members.length} council members${moderator ? ' + 1 moderator' : ''}`, { 
            color: Config.colors.green 
        });

        return { members, moderator };
    }

    /**
     * Get opinion from a specific council member
     */
    async getMemberOpinion(member: CouncilMember): Promise<string> {
        if (!this.session) {
            throw new Error('No active council session');
        }

        const prompt = `${member.prompt}

Based on the conversation above, what is your opinion about the approach being taken?

Please provide:
1. Your assessment of the current approach
2. Any concerns or suggestions
3. Your vote/recommendation in [VOTE] format at the end

Example: [VOTE] Proceed with the JWT approach but simplify the refresh token logic`;

        try {
            LogUtils.print(`🎯 Getting opinion from ${member.name}...`, { color: Config.colors.blue });
            
            const opinion = await this.processor.processMessages(
                this.session.originalMessages,
                prompt
            );

            this.session.opinions.set(member.name, opinion);
            
            LogUtils.print(`✓ ${member.name} opinion received`, { color: Config.colors.green });
            
            // Print the opinion immediately for user to see
            LogUtils.print('', { color: Config.colors.white });
            LogUtils.print(`## ${member.name}`, { color: Config.colors.cyan });
            LogUtils.print(opinion, { color: Config.colors.white });
            LogUtils.print('', { color: Config.colors.white });
            LogUtils.print('─'.repeat(50), { color: Config.colors.dim });
            
            return opinion;

        } catch (error) {
            LogUtils.warn(`Failed to get opinion from ${member.name}: ${error}`);
            const fallbackOpinion = `[ERROR] Failed to get opinion from ${member.name}: ${error}`;
            this.session.opinions.set(member.name, fallbackOpinion);
            
            // Print error opinion as well
            LogUtils.print('', { color: Config.colors.white });
            LogUtils.print(`## ${member.name} (ERROR)`, { color: Config.colors.red });
            LogUtils.print(fallbackOpinion, { color: Config.colors.red });
            LogUtils.print('', { color: Config.colors.white });
            LogUtils.print('─'.repeat(50), { color: Config.colors.dim });
            
            return fallbackOpinion;
        }
    }

    /**
     * Get final consensus from moderator
     */
    async getConsensus(moderator: CouncilMember): Promise<string> {
        if (!this.session) {
            throw new Error('No active council session');
        }

        // Build opinions text for moderator
        const opinionsText = Array.from(this.session.opinions.entries())
            .map(([name, opinion]) => `## ${name}\n${opinion}`)
            .join('\n\n');

        const prompt = `${moderator.prompt}

## Council Member Opinions

${opinionsText}

---

Based on these opinions, please provide:

1. A summary of the key points from all council members
2. Identify if there is consensus or major disagreements
3. Your final recommendation for the user
4. Save your final plan in [PLAN] format

If there's no clear consensus, explain why and suggest how to resolve the disagreements.

Example: [PLAN] All members agree to simplify the auth approach using session storage instead of JWT tokens...`;

        try {
            LogUtils.print(`📋 Moderator synthesizing consensus...`, { color: Config.colors.blue });
            
            const consensus = await this.processor.processMessages(
                this.session.originalMessages,
                prompt
            );

            // Save whatever the moderator outputs - don't try to parse it
            this.session.finalPlan = consensus.trim();
            this.session.consensusAchieved = true; // Always consider it "achieved" since we have a response
            
            LogUtils.print(`✓ Council review completed`, { 
                color: Config.colors.green 
            });

            return consensus;

        } catch (error) {
            LogUtils.warn(`Failed to get consensus from moderator: ${error}`);
            throw new Error(`Consensus failed: ${error}`);
        }
    }

    

    /**
     * Get current session status
     */
    getSessionStatus(): CouncilSession | null {
        return this.session;
    }

    /**
     * Clear current session
     */
    clearSession(): void {
        this.session = null;
        LogUtils.print('🏛️ Council session cleared', { color: Config.colors.cyan });
    }

    /**
     * Check if session is active
     */
    hasActiveSession(): boolean {
        return this.session !== null;
    }

    /**
     * Get final plan if available
     */
    getFinalPlan(): string | null {
        return this.session?.finalPlan || null;
    }
}