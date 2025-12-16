import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Message } from './message-history.js';
import { AIProcessor } from './ai-processor.js';
import { LogUtils } from '../utils/log-utils.js';
import { Config } from './config.js';
import { CouncilCommand } from './commands/council.js';

export interface CouncilMember {
    name: string;
    prompt: string;
}

export interface CouncilSession {
    originalMessages: Message[];
    opinions: Map<string, string>;
    consensusAchieved: boolean;
    finalPlan?: string;
}

export class CouncilService {
    private processor: AIProcessor;
    private session: CouncilSession | null = null;
    private static lastSuccessfulCouncilDir: string | null = null;

    constructor(processor: AIProcessor) {
        this.processor = processor;
    }

    /**
     * Get display files using the same logic as council list
     * This ensures consistency between display and selection
     */
    private getDisplayFiles(sortedFiles: string[]): string[] {
        return sortedFiles.filter(f => 
            f.endsWith('.txt') && f !== 'moderator.txt'
        );
    }

    /**
     * Natural sort function for council members - number-aware sorting
     */
    private naturalSort(a: string, b: string): number {
        // Extract filenames from paths if needed
        const nameA = path.basename(a, '.txt');
        const nameB = path.basename(b, '.txt');
        
        // Check if both start with numbers
        const numA = parseInt(nameA.match(/^(\d+)/)?.[1] || '');
        const numB = parseInt(nameB.match(/^(\d+)/)?.[1] || '');
        
        // If both have numeric prefixes, sort numerically
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        
        // If only one has numeric prefix, it comes first
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;
        
        // Otherwise, sort alphabetically
        return nameA.localeCompare(nameB);
    }

    /**
     * Set the last successful council directory for consistency
     */
    static setLastSuccessfulCouncilDir(dir: string): void {
        this.lastSuccessfulCouncilDir = dir;
    }

    /**
     * Get the last successful council directory
     */
    static getLastSuccessfulCouncilDir(): string | null {
        return this.lastSuccessfulCouncilDir;
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

        LogUtils.print('Council session started', { color: Config.colors.cyan });
    }

    /**
     * Load council members from filesystem with optional filtering
     */
    async loadMembers(filters?: string[], preferAutoModerator: boolean = false, autoMode: boolean = false): Promise<{ members: CouncilMember[], moderator: CouncilMember | null }> {
        
        // AUTO-MODE: If we have cached directory (from previous successful load), use it
        // This prevents "council not found" when process.cwd() changes between auto-council runs
        if (CouncilService.lastSuccessfulCouncilDir) {
            const councilDir = CouncilService.lastSuccessfulCouncilDir;
            return this.loadMembersFromDirectory(councilDir, filters, preferAutoModerator, autoMode);
        }

        // NORMAL MODE: Find council directory and cache it for future auto-mode runs
        const projectCouncilDir = path.join(process.cwd(), '.aicoder/council');
        const globalCouncilDir = path.join(os.homedir(), '.config/aicoder-mini/council');
        const councilDir = fs.existsSync(projectCouncilDir) ? projectCouncilDir : globalCouncilDir;
        
        if (!fs.existsSync(councilDir)) {
            LogUtils.error('Council not configured');
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
        const sortedFiles = files.sort((a, b) => this.naturalSort(a, b));
        const members: CouncilMember[] = [];
        let moderator: CouncilMember | null = null;

        for (const file of files) {
            const name = file.replace('.txt', '');
            
            // Skip deactivated members (starting with _)
            if (name.startsWith('_')) {
                continue;
            }
            
            // Skip auto members in normal mode, and regular members in auto mode
            if (!autoMode && name.includes('_auto')) {
                continue;
            }
            if (autoMode && !name.includes('_auto') && !name.includes('moderator')) {
                continue;
            }
            
            try {
                const content = fs.readFileSync(path.join(councilDir, file), 'utf-8').trim();
                
                if (content.length === 0) {
                    LogUtils.warn(`Empty council member file: ${file}`);
                    continue;
                }

                // Moderator selection logic
                if (name.includes('moderator')) {
                    // For auto mode, prioritize auto moderator
                    if (preferAutoModerator && name.includes('auto')) {
                        moderator = { name, prompt: content };
                        continue;
                    }
                    // If in auto mode and we already have auto moderator, skip regular moderator
                    if (preferAutoModerator && moderator && moderator.name.includes('auto')) {
                        continue;
                    }
                    // Otherwise, use the first moderator found
                    if (!moderator) {
                        moderator = { name, prompt: content };
                    }
                    continue;
                }
                
                // Apply filters to regular members (support both name and number-based filtering)
                if (filters && filters.length > 0) {
                    let matches = false;
                    
                    for (const keyword of filters) {
                        // Check if keyword is a number (number-based filtering)
                        const targetNumber = parseInt(keyword);
                        if (!isNaN(targetNumber)) {
                            // Use EXACT same logic as display for consistency
                            const allDisplayFiles = this.getDisplayFiles(sortedFiles);
                            
                            const memberIndex = allDisplayFiles.indexOf(file);
                            if (memberIndex === targetNumber - 1) {
                                matches = true;
                                break;
                            }
                        } else {
                            // Name-based filtering (existing behavior)
                            if (name.includes(keyword)) {
                                matches = true;
                                break;
                            }
                        }
                    }
                    
                    if (!matches) continue;
                }

                members.push({ name, prompt: content });
            } catch (error) {
                LogUtils.warn(`Failed to load council member ${file}: ${error}`);
            }
        }

        // Cache successful council directory for auto-mode consistency
        if (members.length > 0 || moderator) {
            CouncilService.lastSuccessfulCouncilDir = councilDir;
        }

        // Show which council source is being used
        const isProjectSpecific = councilDir === path.join(process.cwd(), '.aicoder/council');
        const sourceType = isProjectSpecific ? 'Project' : 'Global';
        LogUtils.print(`Using ${sourceType} council: ${councilDir}`, {
            color: Config.colors.cyan
        });
        LogUtils.print(`✓ Found ${members.length} council members${moderator ? ' + 1 moderator' : ''}`, {
            color: Config.colors.green
        });

        return { members, moderator };
    }

    /**
     * Load council members from a specific directory
     */
    private async loadMembersFromDirectory(
        councilDir: string,
        filters?: string[],
        preferAutoModerator: boolean = false,
        autoMode: boolean = false
    ): Promise<{ members: CouncilMember[], moderator: CouncilMember | null }> {
        if (!fs.existsSync(councilDir)) {
            return { members: [], moderator: null };
        }

        const files = fs.readdirSync(councilDir).filter(f => f.endsWith('.txt'));
        const sortedFiles = files.sort((a, b) => this.naturalSort(a, b));
        const members: CouncilMember[] = [];
        let moderator: CouncilMember | null = null;

        for (const file of sortedFiles) {
            const name = file.replace('.txt', '');
            
            // Apply auto mode filtering - for display consistency, don't skip files here
            // Auto mode will only use auto members, but for indexing we include all display files
            
            try {
                const content = fs.readFileSync(path.join(councilDir, file), 'utf-8').trim();
                
                if (content.length === 0) {
                    continue;
                }

                // Moderator selection logic
                if (name.includes('moderator')) {
                    // For auto mode, prioritize auto moderator
                    if (preferAutoModerator && name.includes('auto')) {
                        moderator = { name, prompt: content };
                        continue;
                    }
                    // If in auto mode and we already have auto moderator, skip regular moderator
                    if (preferAutoModerator && moderator && moderator.name.includes('auto')) {
                        continue;
                    }
                    // Otherwise, use the first moderator found
                    if (!moderator) {
                        moderator = { name, prompt: content };
                    }
                    continue;
                }
                
                // Apply auto/normal mode filtering first
                if (autoMode && !name.includes('_auto')) {
                    // In auto mode: skip non-auto members
                    continue;
                } else if (!autoMode && name.includes('_auto')) {
                    // In normal mode: skip auto members
                    continue;
                }
                
                // Apply filters to remaining members (support both name and number-based filtering)
                if (filters && filters.length > 0) {
                    let matches = false;
                    
                    for (const keyword of filters) {
                        // Check if keyword is a number (number-based filtering)
                        const targetNumber = parseInt(keyword);
                        if (!isNaN(targetNumber)) {
                            // Use EXACT same logic as display for consistency
                            const allDisplayFiles = this.getDisplayFiles(sortedFiles);
                            
                            const memberIndex = allDisplayFiles.indexOf(file);
                            if (memberIndex === targetNumber - 1) {
                                matches = true;
                                break;
                            }
                        } else {
                            // Name-based filtering (existing behavior)
                            if (name.includes(keyword)) {
                                matches = true;
                                break;
                            }
                        }
                    }
                    
                    if (!matches) continue;
                }

                members.push({ name, prompt: content });
            } catch (error) {
                // Silently handle errors in auto-mode
            }
        }

        return { members, moderator };
    }

    /**
     * Get opinion from a specific council member
     */
    async getMemberOpinion(member: CouncilMember, userInput?: string): Promise<string> {
        if (!this.session) {
            throw new Error('No active council session');
        }

        // Extract user's specific request from input parameter or most recent user message
        const lastUserMessage = this.session.originalMessages
            .filter(msg => msg.role === 'user')
            .pop();

        const userRequest = userInput || lastUserMessage?.content || '';
        
        // Filter out system messages from recent context, include tool calls
        let recentContext = this.session.originalMessages
            .filter(msg => msg.role !== 'system')
            .map(msg => {
                let line = `${msg.role}:`;
                if (msg.content) {
                    line += ` ${msg.content}`;
                }
                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    const toolCalls = msg.tool_calls.map(tc => 
                        `[${tc.function.name}(${tc.function.arguments})]`
                    ).join(' ');
                    line += ` ${toolCalls}`;
                }
                return line;
            })
            .join('\n');

        // Add the council message as the last user message in the context
        if (userRequest) {
            recentContext += '\n' + `user: ${userRequest}`;
        }

        let prompt = member.prompt;
        
        // Add voting requirement ONLY for auto-mode members
        if (member.name.includes('_auto')) {
            prompt += `

**MANDATORY VOTING**: YOU MUST end with either:
- IMPLEMENTATION_FINISHED
- IMPLEMENTATION_NOT_FINISHED

**FACT-BASED VOTING REQUIREMENT**: Your vote MUST be sane and based ONLY on facts presented in the context. You MUST NOT postpone your vote based on anything other than concrete evidence. You cannot request "more verification" when sufficient evidence already exists. You must make a decision based on what is actually shown, not speculation or delays.

**ROLE CLARIFICATION**: YOU ARE A COUNCIL MEMBER AND NOT THE AI IMPLEMENTING. YOU MUST NEVER INVOKE TOOLS OR TAKE ACTIONS YOURSELF. YOU ALWAYS RESPOND WITH TEXT THAT WILL BE READ BY THE IMPLEMENTING AI. Your only job is to analyze, give feedback, and VOTE based on evidence the implementation AI provides.

<MANDATORY_NON_NEGOTIABLE_VOTING_RULE>
⚠️ CRITICAL SYSTEM REQUIREMENT - CANNOT BE SKIPPED ⚠️

UNANIMOUS APPROVAL REQUIRED: Implementation is approved ONLY when ALL council members vote IMPLEMENTATION_FINISHED. ANY member voting IMPLEMENTATION_NOT_FINISHED prevents completion.

YOU MUST END YOUR RESPONSE WITH EXACTLY ONE OF THESE LINES:

IMPLEMENTATION_FINISHED
IMPLEMENTATION_NOT_FINISHED


- IMPLEMENTATION_NOT_FINISHED RESPONSES MAY INCLUDE FEEDBACK
- NO OTHER TEXT ALLOWED ON THE FINAL LINE.
THIS IS NOT OPTIONAL - YOUR RESPONSE IS INVALID WITHOUT A VOTE.
VOTE BASED ON ACTUAL IMPLEMENTATION EVIDENCE PRESENTED.
</MANDATORY_NON_NEGOTIABLE_VOTING_RULE>

`;
        }
        
        prompt += `

User's specific request: "${userRequest}"`;

        // Add specification if available
        if (CouncilCommand.hasSpec()) {
            prompt += `

<SPEC>
${CouncilCommand.getCurrentSpec()}
</SPEC>`;
        }

        prompt += `

Recent context (most recent messages appear last):
${recentContext}`;

        // Debug: Print the full prompt being sent
        if (Config.debug) {
            LogUtils.print(`Prompt being sent to ${member.name}:`, { color: Config.colors.yellow });
            LogUtils.print(prompt, { color: Config.colors.dim });
            LogUtils.print('─'.repeat(50), { color: Config.colors.dim });
        }

        try {
            LogUtils.print(`Getting opinion from ${member.name}...`, { color: Config.colors.blue });
            
            const opinion = await this.processor.processMessages(
                this.session.originalMessages,
                prompt,
                { 
                    excludeTools: true,  // Council members should not have tool access
                    systemPrompt: `You are ${member.name}. Read your role and instructions in the <COUNCIL_MEMBER_PROFILE> section of the first user message.`
                }
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
     * Get direct expert opinions (no moderator synthesis)
     */
    async getDirectExpertOpinions(): Promise<string> {
        if (!this.session) {
            throw new Error('No active council session');
        }

        // Build direct opinions summary
        const opinionsText = Array.from(this.session.opinions.entries())
            .map(([name, opinion]) => `## ${name}\n${opinion}`)
            .join('\n\n');

        // Create a summary from all opinions
        const summary = `# Council Expert Opinions

${opinionsText}

---

## Implementation Decision

Council moderator will review these opinions and provide final decision.

## Key Recommendations Summary

${this.summarizeKeyPoints()}`;

        // Save the direct opinions as the final plan
        this.session.finalPlan = summary.trim();
        this.session.consensusAchieved = true;
        
        LogUtils.print(`✓ Direct expert opinions compiled`, { 
            color: Config.colors.green 
        });

        return summary;
    }

    /**
     * Get final consensus from moderator (for regular council mode)
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
            LogUtils.print(`Moderator synthesizing consensus...`, { color: Config.colors.blue });
            
            const consensus = await this.processor.processMessages(
                this.session.originalMessages,
                prompt,
                { 
                    excludeTools: true,  // Moderator should not have tool access
                    systemPrompt: `You are the council moderator. Read your role and instructions in the <COUNCIL_MEMBER_PROFILE> section of the first user message.`
                }
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
     * Check if implementation is approved based on expert opinions
     */
    private checkApprovalStatus(opinions: Map<string, string>): { approved: boolean; reasoning: string } {
        const approvals: string[] = [];
        const rejections: string[] = [];
        const concerns: string[] = [];
        
        opinions.forEach((opinion, name) => {
            const lowerOpinion = opinion.toLowerCase();
            
            // Look for explicit approval
            if (lowerOpinion.includes('implement') && 
                (lowerOpinion.includes('approve') || 
                 lowerOpinion.includes('approved') ||
                 lowerOpinion.includes('ready') ||
                 lowerOpinion.includes('good') ||
                 lowerOpinion.includes('acceptable'))) {
                approvals.push(name);
            }
            
            // Look for explicit rejection or issues
            if (lowerOpinion.includes('issue') ||
                lowerOpinion.includes('problem') ||
                lowerOpinion.includes('concern') ||
                lowerOpinion.includes('missing') ||
                lowerOpinion.includes('need') ||
                lowerOpinion.includes('should') ||
                lowerOpinion.includes('recommend') ||
                lowerOpinion.includes('fix')) {
                
                // Extract the concern
                const lines = opinion.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.match(/^(issue|problem|concern|missing|need|should|recommend|fix)/i)) {
                        concerns.push(`${name}: ${trimmed}`);
                        break;
                    }
                }
                rejections.push(name);
            }
        });
        
        // Decision logic
        const approved = approvals.length > rejections.length && concerns.length === 0;
        
        let reasoning = '';
        if (approved) {
            reasoning = `All experts agree the implementation meets requirements. Approvals from: ${approvals.join(', ')}`;
        } else {
            reasoning = `Implementation requires changes:\n\n${concerns.slice(0, 5).join('\n')}`;
            if (concerns.length > 5) {
                reasoning += `\n... and ${concerns.length - 5} more concerns`;
            }
        }
        
        return { approved, reasoning };
    }

    /**
     * Get member consensus for auto-continue
     */
    async getMemberConsensus(): Promise<string> {
        if (!this.session) {
            throw new Error('No active council session');
        }

        // Count votes from all members
        const votes = Array.from(this.session.opinions.entries()).map(([name, opinion]) => {
            const lines = opinion.split('\n');
            const lastLine = lines[lines.length - 1].trim();
            
            if (lastLine.includes('IMPLEMENTATION_FINISHED')) {
                return { name, vote: 'FINISHED' };
            } else if (lastLine.includes('IMPLEMENTATION_NOT_FINISHED')) {
                return { name, vote: 'NOT_FINISHED' };
            } else {
                return { name, vote: 'NO_VOTE' };
            }
        });

        // Count consensus
        const finishedVotes = votes.filter(v => v.vote === 'FINISHED').length;
        const notFinishedVotes = votes.filter(v => v.vote === 'NOT_FINISHED').length;
        const noVotes = votes.filter(v => v.vote === 'NO_VOTE').length;

        // Build opinions text for final plan (show only disapprovals to AI)
        const opinionsText = Array.from(this.session.opinions.entries())
            .filter(([name, opinion]) => {
                const lines = opinion.split('\n');
                const lastLine = lines[lines.length - 1].trim();
                
                // Show only NOT_FINISHED or NO_VOTE (treat as issues to fix)
                return lastLine.includes('IMPLEMENTATION_NOT_FINISHED') || 
                       lastLine.includes('IMPLEMENTATION_FINISHED') === false;
            })
            .map(([name, opinion]) => `## ${name}\n${opinion}`)
            .join('\n\n');

        // Unanimous approval required - ANY not_finished = not done
        const decision = notFinishedVotes === 0 && noVotes === 0 ? 'IMPLEMENTATION_FINISHED' : 'IMPLEMENTATION_NOT_FINISHED';
        
        // ORIGINAL LOGIC (commented out for testing):
        // const decision = (finishedVotes > notFinishedVotes && finishedVotes > 0)
        //     ? 'IMPLEMENTATION_FINISHED'
        //     : 'IMPLEMENTATION_NOT_FINISHED';

        // Save decision to final plan
        this.session.finalPlan = `# Council Consensus

${opinionsText}

---

## Vote Summary:
- IMPLEMENTATION_FINISHED: ${finishedVotes}
- IMPLEMENTATION_NOT_FINISHED: ${notFinishedVotes}
- NO_VOTE: ${noVotes}

## Final Decision: ${decision}`;

        LogUtils.print(`✓ Member consensus: ${decision}`, { 
            color: decision.includes('FINISHED') ? Config.colors.green : Config.colors.yellow 
        });

        return decision;
    }

    /**
     * Summarize key points from all opinions
     */
    private summarizeKeyPoints(): string {
        const opinions = Array.from(this.session!.opinions.entries());
        
        if (opinions.length === 0) {
            return "No expert opinions available.";
        }

        // Extract key points by looking for specific patterns
        const keyPoints: string[] = [];
        
        opinions.forEach(([name, opinion]) => {
            const lines = opinion.split('\n');
            
            // Look for recommendation/action items
            lines.forEach(line => {
                const trimmed = line.trim();
                
                // Look for specific recommendation patterns
                if (trimmed.match(/^(recommend|should|must|implement|add|remove|fix|use|avoid|ensure|consider)/i)) {
                    keyPoints.push(`• ${name}: ${trimmed}`);
                }
                
                // Look for finished/not finished
                if (trimmed.includes('IMPLEMENTATION_FINISHED')) {
                    keyPoints.push(`• ${name}: ✅ FINISHED`);
                }
                
                // Look for security concerns
                if (trimmed.match(/^(security|vulnerability|risk|danger|attack|exploit)/i)) {
                    keyPoints.push(`• ${name}: 🔒 ${trimmed}`);
                }
                
                // Look for UX concerns
                if (trimmed.match(/^(ux|user|interface|experience|workflow)/i)) {
                    keyPoints.push(`• ${name}: 🎨 ${trimmed}`);
                }
            });
        });

        if (keyPoints.length === 0) {
            // Fallback: just include the first line from each opinion
            opinions.forEach(([name, opinion]) => {
                const firstLine = opinion.split('\n')[0].trim();
                if (firstLine) {
                    keyPoints.push(`• ${name}: ${firstLine}`);
                }
            });
        }

        return keyPoints.slice(0, 10).join('\n') + (keyPoints.length > 10 ? `\n... and ${keyPoints.length - 10} more points` : '');
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
        LogUtils.print('Council session cleared', { color: Config.colors.cyan });
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