/**
 * Council Command - Core command for expert opinions
 * Provides council review of current AI work
 */

import { BaseCommand, type CommandContext } from './base.js';
import { AIProcessor } from '../ai-processor.js';
import { CouncilService } from '../council-service.js';
import { StreamingClient } from '../streaming-client.js';
import { ToolManager } from '../tool-manager.js';
import { Config } from '../config.js';
import { LogUtils } from '../../utils/log-utils.js';
import { PromptBuilder } from '../../prompts/prompt-builder.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { exec } from 'node:child_process';
import { randomBytes } from 'node:crypto';

export class CouncilCommand extends BaseCommand {
    private councilService: CouncilService;
    private processor: AIProcessor;
    
    // Auto-council spec management
    private static currentSpec: string | null = null;
    private static currentSpecFile: string | null = null;
    
    // Cache successful council directory for consistency
    private static lastSuccessfulCouncilDir: string | null = null;

    constructor(context: CommandContext) {
        super(context);
        
        // Create processor for AI interactions
        const streamingClient = new StreamingClient(context.stats, new ToolManager(context.stats));
        this.processor = new AIProcessor(streamingClient);
        this.councilService = new CouncilService(this.processor);
    }

    protected name = 'council';
    protected description = 'Get expert opinions on current work';

    getAliases(): string[] {
        return ['cc', 'c'];
    }

    async execute(args: string[]): Promise<{ shouldQuit: boolean; runApiCall: boolean }> {
        const colors = Config.colors;

        try {
            // Parse command line options and message
            let filters: string[] = [];
            let subcommand: string | null = null;
            let message = '';

            // Parse arguments
            let i = 0;
            let autoMode = false;
            let autoContinue = false;
            let directOpinions = false;
            let resetContext = Config.autoCouncilResetContext; // Default to config
            while (i < args.length) {
                const arg = args[i];
                
                // Check for subcommands (no -- prefix)
                if (arg.toLowerCase() === 'current' || arg.toLowerCase() === 'accept' || 
                    arg.toLowerCase() === 'clear' || arg.toLowerCase() === 'help' ||
                    arg.toLowerCase() === 'list' || arg.toLowerCase() === 'list-members' ||
                    arg.toLowerCase() === 'edit' || arg.toLowerCase() === 'enable' ||
                    arg.toLowerCase() === 'disable') {
                    subcommand = arg.toLowerCase();
                    i++;
                    break;
                }
                // Check for --members flag
                else if (arg === '--members' && i + 1 < args.length) {
                    filters = args[i + 1].split(',').map(f => f.trim());
                    i += 2;
                }
                // Check for --auto flag
                else if (arg === '--auto') {
                    autoMode = true;
                    i++;
                }
                // Check for --reset-context flag
                else if (arg === '--reset-context') {
                    resetContext = true;
                    i++;
                }
                // Check for --no-reset flag
                else if (arg === '--no-reset') {
                    resetContext = false;
                    i++;
                }
                // Check for --auto-continue flag (internal use)
                else if (arg === '--auto-continue') {
                    autoContinue = true;
                    i++;
                }
                // Check for --direct flag
                else if (arg === '--direct') {
                    directOpinions = true;
                    i++;
                }
                // Everything else is part of the message
                else {
                    break;
                }
            }

            // Check for subcommands first
            if (subcommand) {
                if (subcommand === 'current') {
                    return this.showCurrentPlan();
                } else if (subcommand === 'accept') {
                    return this.acceptPlan();
                } else if (subcommand === 'clear') {
                    return this.clearSession();
                } else if (subcommand === 'help') {
                    return this.showHelp();
                } else if (subcommand === 'list' || subcommand === 'list-members') {
                    return this.listMembers();
                } else if (subcommand === 'edit') {
                    return this.editMember(args.slice(i).join(' '));
                } else if (subcommand === 'enable') {
                    return this.toggleMember(args.slice(i).join(' '), true);
                } else if (subcommand === 'disable') {
                    return this.toggleMember(args.slice(i).join(' '), false);
                }
                return { shouldQuit: false, runApiCall: false };
            }

            // Handle auto-continue special case (internal use after AI implementation)
            if (autoContinue) {
                console.log('DEBUG: Council command called with autoContinue=true');
                // This is triggered after AI implementation to review the changes
                if (!CouncilCommand.hasSpec()) {
                    LogUtils.warn('Auto-continue called but no spec loaded');
                    return { shouldQuit: false, runApiCall: false };
                }

                // Use auto-mode council members AND enable autoMode
                filters = ['auto'];
                autoMode = true;
                message = 'review the implementation against the specification';
                
                LogUtils.print('\n🔄 Auto-mode: Reviewing implementation...', { color: colors.cyan });
                
                // Use whatever directory was cached from the first run
                // Don't override - trust the cache from the initial discovery
            }
            // Handle auto-mode special case - file path OR text content
            else if (autoMode) {
                // Extract spec argument from remaining arguments
                if (i >= args.length) {
                    LogUtils.error('Auto-mode requires specification: /council --auto <file_or_message>');
                    return { shouldQuit: false, runApiCall: false };
                }
                
                // Get the full remaining content as one argument (supports spaces)
                const specArgument = args.slice(i).join(' ');
                
                // Check if argument contains spaces - if yes, treat as text content
                // If no spaces, treat as file path (existing behavior)
                if (specArgument.includes(' ')) {
                    // Text content mode - save to .aicoder/current-spec.md
                    const workingSpecDir = path.join(process.cwd(), '.aicoder');
                    const workingSpecPath = path.join(workingSpecDir, 'current-spec.md');
                    
                    // Ensure .aicoder directory exists
                    if (!fs.existsSync(workingSpecDir)) {
                        fs.mkdirSync(workingSpecDir, { recursive: true });
                    }
                    
                    // Write text content to spec file
                    fs.writeFileSync(workingSpecPath, specArgument, 'utf-8');
                    
                    // Load spec into memory
                    CouncilCommand.loadSpec(specArgument, workingSpecPath);
                    message = 'implement the specification';
                    
                    LogUtils.print('📋 Loaded specification from text', { color: colors.green });
                    LogUtils.print(`📝 Spec saved to: ${workingSpecPath}`, { color: colors.cyan });
                } else {
                    // File path mode - existing behavior
                    const specFile = specArgument;
                    const fullSpecPath = path.resolve(process.cwd(), specFile);
                    
                    if (!fs.existsSync(fullSpecPath)) {
                        LogUtils.error(`File "${specFile}" not found`);
                        return { shouldQuit: false, runApiCall: false };
                    }
                    
                    // Copy spec to working location and load into memory
                    const workingSpecDir = path.join(process.cwd(), '.aicoder');
                    const workingSpecPath = path.join(workingSpecDir, 'current-spec.md');
                    
                    // Ensure .aicoder directory exists
                    if (!fs.existsSync(workingSpecDir)) {
                        fs.mkdirSync(workingSpecDir, { recursive: true });
                    }
                    
                    // Copy spec to working location (only if different paths)
                    if (fullSpecPath !== workingSpecPath) {
                        fs.copyFileSync(fullSpecPath, workingSpecPath);
                    }
                    
                    // Load working spec into memory (not original)
                    CouncilCommand.loadSpec(fs.readFileSync(workingSpecPath, 'utf-8'), workingSpecPath);
                    message = 'implement the specification';
                    
                    LogUtils.print(`📋 Loaded specification: ${specFile}`, { color: colors.green });
                    LogUtils.print(`📝 Working spec copied to: ${workingSpecPath}`, { color: colors.cyan });
                }
            } else {
                // Extract message from remaining arguments
                if (i < args.length) {
                    message = args.slice(i).join(' ');
                }

                // Show help by default if no message provided
                if (!message) {
                    return this.showHelp();
                }
            }

            // Start council session
            await this.councilService.startSession(this.context.messageHistory.getMessages());

            // Load council members - use auto-mode specific members in auto mode
            const memberFilters = autoMode ? ['auto'] : filters;
            
            const { members, moderator } = await this.councilService.loadMembers(memberFilters, autoMode, autoMode);

            if (members.length === 0) {
                LogUtils.error('No council members found. Check ~/.config/aicoder-mini/council/');
                LogUtils.print('');
                LogUtils.print('Available council member patterns:', { color: Config.colors.cyan });
                LogUtils.print('  • code_reviewer_auto.txt - Code quality and implementation guidance', { color: Config.colors.white });
                LogUtils.print('  • security_expert_auto.txt - Security implementation advice', { color: Config.colors.white });
                LogUtils.print('  • ux_designer_auto.txt - User experience recommendations', { color: Config.colors.white });
                LogUtils.print('  • simplicity_advocate_auto.txt - Simplicity and MVP guidance', { color: Config.colors.white });
                LogUtils.print('  • spec_validator_auto.txt - Specification breakdown and validation', { color: Config.colors.white });
                return { shouldQuit: false, runApiCall: false };
            }

            // Get opinions from all members
            for (const member of members) {
                await this.councilService.getMemberOpinion(member, message);
            }

            // Get expert opinions first
            await this.councilService.getDirectExpertOpinions();
            
            // Auto-mode uses member consensus for final decision
            if (autoMode) {
                const decision = await this.councilService.getMemberConsensus();
                
                LogUtils.print('📝 Using expert opinions + moderator decision (auto-mode)', { 
                    color: Config.colors.green 
                });
            } else if (directOpinions && !autoMode) {
                LogUtils.print('📝 Using direct expert opinions (no moderator)', { 
                    color: Config.colors.cyan 
                });
            } else if (moderator) {
                await this.councilService.getConsensus(moderator);
                
                LogUtils.print('📝 Using moderator synthesis (token-efficient)', { 
                    color: Config.colors.cyan 
                });
            } else {
                // Fallback - we already got direct opinions above
                LogUtils.print('📝 Using direct expert opinions (no moderator available)', { 
                    color: Config.colors.yellow 
                });
            }
            
            const session = this.councilService.getSessionStatus();
            if (session?.finalPlan) {
                LogUtils.print('\nCouncil Review:', { color: colors.cyan });
                LogUtils.print(session.finalPlan, { color: colors.green });
                    
                    // Auto-mode logic
                    if (autoMode) {
                        // Check the final decision line - need to find the actual decision
                        const lines = session.finalPlan.split('\n');
                        const decisionLine = lines.find(line => 
                            line.trim().startsWith('## Final Decision:')
                        );
                        // Extract the decision from the "## Final Decision:" line
                        const decision = decisionLine?.replace('## Final Decision:', '').trim();
                        const isFinished = decision === 'IMPLEMENTATION_FINISHED';
                        
                        if (isFinished) {
                            LogUtils.print('\n✅ Auto-mode: Implementation finished!', { color: colors.green });
                            
                            // Job is done - clear spec and exit
                            if (CouncilCommand.hasSpec()) {
                                LogUtils.print('📋 Spec cleared: Implementation complete', { color: colors.blue });
                                CouncilCommand.clearSpec();
                            }
                            
                            return { shouldQuit: false, runApiCall: false };
                        } else {
                            // NOT FINISHED - need to implement or revise
                            LogUtils.print('\n🔄 Auto-mode: Implementation needed...', { color: colors.yellow });
                            
                            // Trigger AI implementation - don't clear spec yet!
                            let implementPrompt = 'Please implement the specification based on the council feedback:\n\n';
                            
                            // Add only non-approving council feedback (focus AI on what needs fixing)
                            const session = this.councilService.getSessionStatus();
                            if (session?.opinions && session.opinions.size > 0) {
                                const nonApprovingOpinions = Array.from(session.opinions.entries())
                                    .filter(([name, opinion]) => {
                                        const lastLine = opinion.split('\n').pop().trim();
                                        return lastLine.includes('IMPLEMENTATION_NOT_FINISHED') || 
                                               lastLine.includes('IMPLEMENTATION_FINISHED') === false;
                                    })
                                    .map(([name, opinion]) => `## ${name}\n${opinion}`);
                                
                                if (nonApprovingOpinions.length > 0) {
                                    implementPrompt += nonApprovingOpinions.join('\n\n');
                                } else {
                                    implementPrompt += 'All members approved - but implementation still needs work.';
                                }
                            } else {
                                implementPrompt += 'No council feedback available.';
                            }
                            
                            if (CouncilCommand.hasSpec()) {
                                implementPrompt += `

---

SPECIFICATION:
${CouncilCommand.getCurrentSpec()}

Implement this specification completely.`;
                            }
                            
                            this.context.messageHistory.addUserMessage(implementPrompt);
                            this.councilService.clearSession();
                            
                            const specFile = CouncilCommand.getCurrentSpecFile();
                            // Spec file must exist when auto-council logic is activated
                            const autoPrompt = `/council --auto ${specFile}`;
                            this.context.aiCoder?.setNextPrompt(autoPrompt);
                            return { shouldQuit: false, runApiCall: true };
                        }
                    }
                    // Auto-continue logic (after AI implementation review)
                    else if (autoContinue) {
                        // Check the final decision line - need to find the actual decision
                        const lines = session.finalPlan.split('\n');
                        const decisionLine = lines.find(line => 
                            line.trim().startsWith('## Final Decision:')
                        );
                        // Extract the decision from the "## Final Decision:" line
                        const decision = decisionLine?.replace('## Final Decision:', '').trim();
                        const isFinished = decision === 'IMPLEMENTATION_FINISHED';
                        
                        if (isFinished) {
                            LogUtils.print('\n✅ Auto-continue: Implementation finished!', { color: colors.green });
                            if (CouncilCommand.hasSpec()) {
                                LogUtils.print('📋 Spec cleared: Implementation complete', { color: colors.blue });
                                CouncilCommand.clearSpec();
                            }
                            // NOW we can exit - implementation is done and finished
                            return { shouldQuit: false, runApiCall: false };
                        } else {
                            LogUtils.print(`\n🔄 Auto-continue: Implementation needs revisions...`, { color: colors.yellow });
                            
                            // Build focused prompt with council feedback and spec
                            let focusedPrompt = `Council feedback on your implementation: ${session.finalPlan}

Please address these issues in your implementation. Focus only on the specific issues raised in the council feedback.`;
                            
                            // Add spec if available
                            if (CouncilCommand.hasSpec()) {
                                focusedPrompt += `

---

SPECIFICATION:
${CouncilCommand.getCurrentSpec()}

The above specification defines the requirements. Ensure your revised implementation addresses both the council feedback and the specification requirements.`;
                            }
                            
                            this.context.messageHistory.addUserMessage(focusedPrompt);
                            this.councilService.clearSession();
                            
                            const specFile = CouncilCommand.getCurrentSpecFile();
                            // Spec file must exist when auto-council logic is activated
                            const autoPrompt = `/council --auto ${specFile}`;
                            this.context.aiCoder?.setNextPrompt(autoPrompt);
                            return { shouldQuit: false, runApiCall: true };
                        }
                    }
                    else {
                        LogUtils.print('\nUse /council accept to inject this review into conversation', { 
                            color: colors.yellow 
                        });
                    }
                }
        } catch (error) {
            LogUtils.error(`Council command failed: ${error}`);
        }

        return { shouldQuit: false, runApiCall: false };
    }

    private showCurrentPlan(): { shouldQuit: boolean; runApiCall: boolean } {
        const session = this.councilService.getSessionStatus();
        
        if (!session) {
            LogUtils.print('No active council session', { color: Config.colors.yellow });
            return { shouldQuit: false, runApiCall: false };
        }

        if (session.finalPlan) {
            LogUtils.print('Current Council Review:', { color: Config.colors.cyan });
            LogUtils.print(session.finalPlan, { color: Config.colors.green });
        } else {
            LogUtils.print('No council review available', { color: Config.colors.yellow });
        }

        return { shouldQuit: false, runApiCall: false };
    }

    private acceptPlan(): { shouldQuit: boolean; runApiCall: boolean } {
        const session = this.councilService.getSessionStatus();
        
        if (!session) {
            LogUtils.print('No active council session', { color: Config.colors.yellow });
            return { shouldQuit: false, runApiCall: false };
        }

        if (!session.finalPlan) {
            LogUtils.print('No final plan to accept', { color: Config.colors.yellow });
            return { shouldQuit: false, runApiCall: false };
        }

        // Inject plan into conversation
        this.context.messageHistory.addUserMessage(`Council feedback: ${session.finalPlan}`);
        
        LogUtils.print('Council plan injected into conversation', { color: Config.colors.green });
        LogUtils.print('The AI will now consider this feedback in its response', { 
            color: Config.colors.cyan 
        });

        // Clear session after acceptance
        this.councilService.clearSession();

        // Trigger AI to respond to the feedback
        return { shouldQuit: false, runApiCall: true };
    }

    private clearSession(): { shouldQuit: boolean; runApiCall: boolean } {
        this.councilService.clearSession();
        return { shouldQuit: false, runApiCall: false };
    }

    private listMembers(): { shouldQuit: boolean; runApiCall: boolean } {
        const colors = Config.colors;
        
        try {
            const { dir: councilDir, isProjectSpecific } = this.getCouncilDirectory();
            const sourceType = isProjectSpecific ? 'Project' : 'Global';
            const memberFiles = this.getSortedMemberFiles(true); // Show disabled members
            
            // Check for moderator
            const files = fs.readdirSync(councilDir);
            const moderatorExists = files.includes('moderator.txt');

            LogUtils.print('Council Members:', { color: colors.cyan });
            LogUtils.print('', { color: colors.white });
            LogUtils.print(`Using ${sourceType} Council:`, { color: colors.yellow });
            LogUtils.print(`  ${councilDir}`, { color: colors.white });
            LogUtils.print('', { color: colors.white });

            if (memberFiles.length === 0 && !moderatorExists) {
                LogUtils.print('No council members found.', { color: colors.red });
                LogUtils.print('Create .txt files in the council directory.', { color: colors.yellow });
                return { shouldQuit: false, runApiCall: false };
            }

            if (memberFiles.length > 0) {
                LogUtils.print('Members:', { color: colors.blue });
                let index = 1;
                for (const member of memberFiles) {
                    const filePath = path.join(councilDir, member.file);
                    const memberColor = member.disabled ? colors.dim : colors.white;
                    const status = member.disabled ? ' (disabled)' : '';
                    
                    LogUtils.print(`  ${index}) ${member.name}${status}`, { color: memberColor });
                    index++;
                }
            }

            if (moderatorExists) {
                LogUtils.print('', { color: colors.white });
                LogUtils.print('Moderator (always included):', { color: colors.green });
                LogUtils.print('  - moderator', { color: colors.white });
            }

            LogUtils.print('', { color: colors.white });
            LogUtils.print('Usage examples:', { color: colors.yellow });
            if (memberFiles.length > 0) {
                const example1 = Math.min(1, memberFiles.length);
                const example2 = Math.min(2, memberFiles.length);
                LogUtils.print(`  /council --members ${example1},${example2} your question here`, { color: colors.white });
                LogUtils.print(`  /council edit ${example1}`, { color: colors.white });
                LogUtils.print(`  /council enable ${memberFiles[0].name.startsWith('_') ? memberFiles[0].name.substring(1) : memberFiles[0].name}`, { color: colors.white });
            }
            LogUtils.print('  /council what do you think about this approach?', { color: colors.white });

        } catch (error) {
            LogUtils.error(`Failed to read council directory: ${error}`);
        }

        return { shouldQuit: false, runApiCall: false };
    }

    private showHelp(): { shouldQuit: boolean; runApiCall: boolean } {
        const colors = Config.colors;
        const path = require('path');
        const os = require('os');
        const fs = require('fs');
        
        // Determine which council directory is actually being used
        const projectCouncilDir = path.join(process.cwd(), '.aicoder/council');
        const globalCouncilDir = path.join(os.homedir(), '.config/aicoder-mini/council');
        const councilDir = fs.existsSync(projectCouncilDir) ? projectCouncilDir : globalCouncilDir;
        const isProjectSpecific = councilDir === projectCouncilDir;
        const sourceType = isProjectSpecific ? 'Project' : 'Global';
        
        LogUtils.print('Council Command Help:', { color: colors.cyan });
        LogUtils.print('', { color: colors.white });
        LogUtils.print('Usage:', { color: colors.yellow });
        LogUtils.print('  /council <message>                               Get opinions from all council members (moderated)', { color: colors.white });
        LogUtils.print('  /council --direct <message>                      Get direct expert opinions (no moderator)', { color: colors.cyan });
        LogUtils.print('  /council --members member1,member2 <message>    Get opinions from specific members', { color: colors.white });
        LogUtils.print('  /council --auto <spec.md>                      Auto-iterate using specification file', { color: colors.green });
        LogUtils.print('  /council --auto "any text message"             Auto-iterate using text as specification', { color: colors.green });
        LogUtils.print('  /council --auto --reset-context <spec.md>       Auto-iterate with fresh context each turn', { color: colors.green });
        LogUtils.print('  /council --auto --no-reset <spec.md>           Auto-iterate while preserving context', { color: colors.green });
        LogUtils.print('  /council current                                 Show current council plan', { color: colors.white });
        LogUtils.print('  /council accept                                  Accept and inject plan into conversation', { color: colors.white });
        LogUtils.print('  /council clear                                   Clear current council session', { color: colors.white });
        LogUtils.print('  /council list                                    Show available council members', { color: colors.white });
        LogUtils.print('  /council edit <number|name>                      Edit council member file', { color: colors.white });
        LogUtils.print('  /council enable <number|name>                    Enable council member', { color: colors.white });
        LogUtils.print('  /council disable <number|name>                   Disable council member', { color: colors.white });
        LogUtils.print('  /council help                                    Show this help', { color: colors.white });
        LogUtils.print('', { color: colors.white });
        LogUtils.print(`Using ${sourceType} Council:`, { color: colors.yellow });
        LogUtils.print(`  ${councilDir}`, { color: colors.white });
        LogUtils.print('', { color: colors.white });
        LogUtils.print('Member files should be named:', { color: colors.yellow });
        LogUtils.print('  simplicity_advocate.txt, security_expert.txt, performance_guru.txt', { color: colors.white });
        LogUtils.print('  moderator.txt (always included)', { color: colors.white });
        LogUtils.print('', { color: colors.white });
        LogUtils.print('Project-specific councils override global when present:', { color: colors.cyan });
        LogUtils.print(`  Project:  ${projectCouncilDir}`, { color: colors.dim });
        LogUtils.print(`  Global:   ${globalCouncilDir}`, { color: colors.dim });
        
        return { shouldQuit: false, runApiCall: false };
    }

    /**
     * Extract the original task from message history
     */
    private extractOriginalTaskFromHistory(): string {
        const messages = this.context.messageHistory.getMessages();
        
        // Find the first user message (original task)
        for (const message of messages) {
            if (message.role === 'user') {
                // Remove council command prefixes if present
                let content = message.content || '';
                content = content.replace(/^\/council(\s+--\w+)*\s+/i, '');
                return content.trim();
            }
        }
        
        return 'Implementation task';
    }

    /**
     * Build fresh system prompt including AGENTS.md integration
     */
    private async buildFreshSystemPrompt(): Promise<string> {
        // Initialize prompt builder if needed
        if (!PromptBuilder.isInitialized) {
            await PromptBuilder.initialize();
        }

        // Load external files
        const overridePrompt = await PromptBuilder.loadPromptOverride();
        const agentsContent = await PromptBuilder.loadAgentsContent();

        // Build context
        const context = {
            agentsContent: agentsContent || '',
            currentDirectory: process.cwd(),
            currentDatetime: new Date().toISOString(),
            systemInfo: PromptBuilder.getSystemInfo(),
        };

        // Build options
        const options = {
            overridePrompt: overridePrompt || undefined,
        };

        return PromptBuilder.buildPrompt(context, options);
    }

    /**
     * Load specification into static memory
     */
    static loadSpec(content: string, filePath?: string): void {
        this.currentSpec = content;
        if (filePath) {
            this.currentSpecFile = filePath;
        }
    }

    /**
     * Clear current specification from memory
     */
    static clearSpec(): void {
        this.currentSpec = null;
    }

    /**
     * Check if specification is currently loaded
     */
    static hasSpec(): boolean {
        return this.currentSpec !== null;
    }

    /**
     * Get current specification content
     */
    static getCurrentSpec(): string | null {
        return this.currentSpec;
    }

    /**
     * Get current specification file path
     */
    static getCurrentSpecFile(): string | null {
        return this.currentSpecFile;
    }

    /**
     * Reset static state - for testing only
     */
    static resetState(): void {
        this.currentSpec = null;
        this.currentSpecFile = null;
        this.lastSuccessfulCouncilDir = null;
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
     * Get council directory and validate it exists
     */
    private getCouncilDirectory(): { dir: string; isProjectSpecific: boolean } {
        const projectCouncilDir = path.join(process.cwd(), '.aicoder/council');
        const globalCouncilDir = path.join(os.homedir(), '.config/aicoder-mini/council');
        const councilDir = fs.existsSync(projectCouncilDir) ? projectCouncilDir : globalCouncilDir;
        const isProjectSpecific = councilDir === projectCouncilDir;
        
        if (!fs.existsSync(councilDir)) {
            LogUtils.error('Council directory not found');
            LogUtils.print(`  ${councilDir}`, { color: Config.colors.yellow });
            throw new Error('Council directory not found');
        }
        
        return { dir: councilDir, isProjectSpecific };
    }

    /**
     * Get display files using same logic across all council operations
     */
    private getDisplayFiles(councilDir: string): string[] {
        return fs.readdirSync(councilDir)
            .filter(file => file.endsWith('.txt') && file !== 'moderator.txt')
            .sort((a, b) => this.naturalSort(a, b));
    }

    /**
     * Get sorted council members with their file information
     */
    private getSortedMemberFiles(includeDisabled: boolean = false): Array<{ name: string; file: string; disabled: boolean }> {
        const { dir: councilDir } = this.getCouncilDirectory();
        
        let files = this.getDisplayFiles(councilDir);
        
        if (includeDisabled) {
            // Include disabled files (starting with _)
            files = fs.readdirSync(councilDir)
                .filter(file => file.endsWith('.txt') && file !== 'moderator.txt')
                .sort((a, b) => this.naturalSort(a, b));
        }
            
        return files.map(file => {
            const name = file.replace('.txt', '');
            const disabled = name.startsWith('_');
            return { name, file, disabled };
        });
    }

    /**
     * Edit council member by number or name
     */
    private async editMember(target: string): Promise<{ shouldQuit: boolean; runApiCall: boolean }> {
        if (!target.trim()) {
            LogUtils.error('Usage: /council edit <member_number_or_name>');
            return { shouldQuit: false, runApiCall: false };
        }

        if (!process.env.TMUX) {
            LogUtils.error('This command only works inside a tmux environment');
            return { shouldQuit: false, runApiCall: false };
        }

        try {
            const { dir: councilDir } = this.getCouncilDirectory();
            const memberFiles = this.getSortedMemberFiles();
            
            let targetFile: string;
            let createNew = false;
            
            // Check if target is a number
            const targetNumber = parseInt(target);
            if (!isNaN(targetNumber) && targetNumber > 0 && targetNumber <= memberFiles.length) {
                // Edit by number
                targetFile = memberFiles[targetNumber - 1].file;
            } else {
                // Edit by name - normalize the target
                let normalizedName = target.trim();
                if (!normalizedName.endsWith('.txt')) {
                    normalizedName += '.txt';
                }
                
                // Check if file exists (with or without underscore prefix)
                const exactFile = memberFiles.find(m => m.file === normalizedName || m.file === `_${normalizedName}`);
                if (exactFile) {
                    targetFile = exactFile.file;
                } else {
                    // Create new file
                    targetFile = normalizedName;
                    createNew = true;
                }
            }
            
            const fullPath = path.join(councilDir, targetFile);
            
            const editor = process.env.EDITOR || 'nano';
            const randomSuffix = randomBytes(4).toString('hex');
            const syncPoint = `council_edit_${randomSuffix}`;
            const windowName = `council_edit_${randomSuffix}`;
            
            const tmuxCmd = `tmux new-window -n "${windowName}" 'bash -c "${editor} ${fullPath}; tmux wait-for -S ${syncPoint}"'`;
            
            LogUtils.print(`Opening ${targetFile} in ${editor}...`, { color: Config.colors.cyan });
            
            await new Promise<void>((resolve, reject) => {
                exec(tmuxCmd, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
            
            await new Promise<void>((resolve, reject) => {
                exec(`tmux wait-for ${syncPoint}`, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
            
            // Check if file exists and has content
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf-8').trim();
                if (content.length === 0) {
                    LogUtils.warn(`${targetFile} is empty`, { color: Config.colors.yellow });
                } else {
                    LogUtils.print(`${targetFile} saved successfully`, { color: Config.colors.green });
                }
            }
            
        } catch (error) {
            LogUtils.error(`Failed to edit council member: ${error}`);
        }
        
        return { shouldQuit: false, runApiCall: false };
    }

    /**
     * Enable or disable council member by number or name
     */
    private toggleMember(target: string, enable: boolean): { shouldQuit: boolean; runApiCall: boolean } {
        if (!target.trim()) {
            LogUtils.error(`Usage: /council ${enable ? 'enable' : 'disable'} <member_number_or_name>`);
            return { shouldQuit: false, runApiCall: false };
        }

        try {
            const { dir: councilDir } = this.getCouncilDirectory();
            const memberFiles = this.getSortedMemberFiles();
            
            let targetFile: string;
            let currentName: string;
            
            // Check if target is a number
            const targetNumber = parseInt(target);
            if (!isNaN(targetNumber) && targetNumber > 0 && targetNumber <= memberFiles.length) {
                // Toggle by number
                const member = memberFiles[targetNumber - 1];
                targetFile = member.file;
                currentName = member.name;
            } else {
                // Toggle by name - normalize the target
                let normalizedName = target.trim();
                if (!normalizedName.endsWith('.txt')) {
                    normalizedName += '.txt';
                }
                
                // Find exact match (with or without underscore)
                const member = memberFiles.find(m => 
                    m.file === normalizedName || 
                    m.file === `_${normalizedName}` ||
                    m.name === normalizedName.replace('.txt', '') ||
                    m.name === `_${normalizedName.replace('.txt', '')}`
                );
                
                if (!member) {
                    LogUtils.error(`Member does not exist: ${target}`);
                    return { shouldQuit: false, runApiCall: false };
                }
                
                targetFile = member.file;
                currentName = member.name;
            }
            
            const fullPath = path.join(councilDir, targetFile);
            
            if (enable) {
                // Enable: remove underscore prefix if present
                if (currentName.startsWith('_')) {
                    const newName = currentName.substring(1);
                    const newPath = path.join(councilDir, `${newName}.txt`);
                    
                    if (fs.existsSync(newPath)) {
                        LogUtils.error(`Member already enabled: ${newName}`);
                        return { shouldQuit: false, runApiCall: false };
                    }
                    
                    fs.renameSync(fullPath, newPath);
                    LogUtils.print(`Enabled council member: ${newName}`, { color: Config.colors.green });
                } else {
                    LogUtils.print(`Member already enabled: ${currentName}`, { color: Config.colors.yellow });
                }
            } else {
                // Disable: add underscore prefix if not already present
                if (!currentName.startsWith('_')) {
                    const newName = `_${currentName}`;
                    const newPath = path.join(councilDir, `${newName}.txt`);
                    
                    if (fs.existsSync(newPath)) {
                        LogUtils.error(`Member already disabled: ${newName}`);
                        return { shouldQuit: false, runApiCall: false };
                    }
                    
                    fs.renameSync(fullPath, newPath);
                    LogUtils.print(`Disabled council member: ${newName}`, { color: Config.colors.green });
                } else {
                    LogUtils.print(`Member already disabled: ${currentName}`, { color: Config.colors.yellow });
                }
            }
            
        } catch (error) {
            LogUtils.error(`Failed to ${enable ? 'enable' : 'disable'} council member: ${error}`);
        }
        
        return { shouldQuit: false, runApiCall: false };
    }

    /**
     * Get the base system prompt
     */
    private getBaseSystemPrompt(): string {
        const messages = this.context.messageHistory.getMessages();
        
        // Find the system message
        for (const message of messages) {
            if (message.role === 'system') {
                return message.content || '';
            }
        }
        
        return '';
    }
}