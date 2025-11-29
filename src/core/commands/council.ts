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

export class CouncilCommand extends BaseCommand {
    private councilService: CouncilService;
    private processor: AIProcessor;

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
        return ['c'];
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
            while (i < args.length) {
                const arg = args[i];
                
                // Check for subcommands (no -- prefix)
                if (arg.toLowerCase() === 'current' || arg.toLowerCase() === 'accept' || 
                    arg.toLowerCase() === 'clear' || arg.toLowerCase() === 'help' ||
                    arg.toLowerCase() === 'list' || arg.toLowerCase() === 'list-members') {
                    subcommand = arg.toLowerCase();
                    i++;
                    break;
                }
                // Check for --members flag
                else if (arg === '--members' && i + 1 < args.length) {
                    filters = args[i + 1].split(',').map(f => f.trim());
                    i += 2;
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
                }
                return { shouldQuit: false, runApiCall: false };
            }

            // Extract message from remaining arguments
            if (i < args.length) {
                message = args.slice(i).join(' ');
            }

            // Show help by default if no message provided
            if (!message) {
                return this.showHelp();
            }

            // Start council session
            await this.councilService.startSession(this.context.messageHistory.getMessages());

            // Load council members
            const { members, moderator } = await this.councilService.loadMembers(filters);

            if (members.length === 0) {
                LogUtils.error('No council members found. Check ~/.config/aicoder-mini/council/');
                return { shouldQuit: false, runApiCall: false };
            }

            // Get opinions from all members
            for (const member of members) {
                await this.councilService.getMemberOpinion(member, message);
            }

            // Get moderator response
            if (moderator) {
                await this.councilService.getConsensus(moderator);
                
                const session = this.councilService.getSessionStatus();
                if (session?.finalPlan) {
                    LogUtils.print('\nCouncil Review:', { color: colors.cyan });
                    LogUtils.print(session.finalPlan, { color: colors.green });
                    LogUtils.print('\nUse /council accept to inject this review into conversation', { 
                        color: colors.yellow 
                    });
                }
            } else {
                LogUtils.warn('No moderator found. Create moderator.txt in council directory.');
                const session = this.councilService.getSessionStatus();
                if (session) {
                    LogUtils.print('\nCouncil Member Opinions:', { color: colors.cyan });
                    for (const [name, opinion] of session.opinions) {
                        LogUtils.print(`\n## ${name}`, { color: colors.blue });
                        LogUtils.print(opinion, { color: colors.white });
                    }
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
        const path = require('path');
        const os = require('os');
        const fs = require('fs');
        
        // Determine which council directory is actually being used
        const projectCouncilDir = path.join(process.cwd(), '.aicoder/council');
        const globalCouncilDir = path.join(os.homedir(), '.config/aicoder-mini/council');
        const councilDir = fs.existsSync(projectCouncilDir) ? projectCouncilDir : globalCouncilDir;
        const isProjectSpecific = councilDir === projectCouncilDir;
        const sourceType = isProjectSpecific ? 'Project' : 'Global';
        
        LogUtils.print('Council Members:', { color: colors.cyan });
        LogUtils.print('', { color: colors.white });
        LogUtils.print(`Using ${sourceType} Council:`, { color: colors.yellow });
        LogUtils.print(`  ${councilDir}`, { color: colors.white });
        LogUtils.print('', { color: colors.white });

        try {
            const files = fs.readdirSync(councilDir);
            const memberFiles = files.filter(file => 
                file.endsWith('.txt') && file !== 'moderator.txt'
            ).sort();

            const moderatorExists = files.includes('moderator.txt');

            if (memberFiles.length === 0 && !moderatorExists) {
                LogUtils.print('No council members found.', { color: colors.red });
                LogUtils.print('Create .txt files in the council directory.', { color: colors.yellow });
                return { shouldQuit: false, runApiCall: false };
            }

            if (memberFiles.length > 0) {
                LogUtils.print('Members:', { color: colors.blue });
                for (const file of memberFiles) {
                    const name = file.replace('.txt', '');
                    const filePath = path.join(councilDir, file);
                    
                    // Read first line as description if available
                    try {
                        const content = fs.readFileSync(filePath, 'utf8');
                        const firstLine = content.split('\n')[0].replace(/^#\s*/, '').trim();
                        const description = firstLine && firstLine !== content.split('\n')[0] ? 
                            ` - ${firstLine}` : '';
                        
                        LogUtils.print(`  • ${name}${description}`, { color: colors.white });
                    } catch {
                        LogUtils.print(`  • ${name}`, { color: colors.white });
                    }
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
                const examples = memberFiles.slice(0, 2).map(f => f.replace('.txt', ''));
                LogUtils.print(`  /council --members ${examples.join(',')} your question here`, { color: colors.white });
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
        LogUtils.print('  /council <message>                               Get opinions from all council members', { color: colors.white });
        LogUtils.print('  /council --members member1,member2 <message>    Get opinions from specific members', { color: colors.white });
        LogUtils.print('  /council current                                 Show current council plan', { color: colors.white });
        LogUtils.print('  /council accept                                  Accept and inject plan into conversation', { color: colors.white });
        LogUtils.print('  /council clear                                   Clear current council session', { color: colors.white });
        LogUtils.print('  /council list                                    Show available council members', { color: colors.white });
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
}