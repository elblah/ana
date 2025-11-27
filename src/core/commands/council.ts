/**
 * Council Command - Core command for expert opinions
 * Provides council review of current AI work
 */

import { BaseCommand } from './base.js';
import { AIProcessor } from '../ai-processor.js';
import { CouncilService } from '../council-service.js';
import { StreamingClient } from '../streaming-client.js';
import { ToolManager } from '../tool-manager.js';
import { Config } from '../config.js';
import { LogUtils } from '../../utils/log-utils.js';

export class CouncilCommand extends BaseCommand {
    private councilService: CouncilService;
    private processor: AIProcessor;

    constructor(context: any) {
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
            // Parse filters from arguments
            let filters: string[] = [];
            let subcommand: string | null = null;

            if (args.length > 0) {
                const firstArg = args[0].toLowerCase();
                
                // Check for subcommands
                if (firstArg === 'current') {
                    return this.showCurrentPlan();
                } else if (firstArg === 'accept') {
                    return this.acceptPlan();
                } else if (firstArg === 'clear') {
                    return this.clearSession();
                } else if (firstArg === 'help') {
                    return this.showHelp();
                } else {
                    // Treat as filters
                    filters = args[0].split(',');
                }
            }

            // Get current conversation
            const messages = this.context.messageHistory.getMessages();
            
            if (messages.length <= 2) {
                LogUtils.warn('No conversation to review. Start working on something first.');
                return { shouldQuit: false, runApiCall: false };
            }

            // Start council session
            await this.councilService.startSession(messages);

            // Load council members
            const { members, moderator } = await this.councilService.loadMembers(filters);

            if (members.length === 0) {
                LogUtils.error('No council members found. Check ~/.config/aicoder-mini/council/');
                return { shouldQuit: false, runApiCall: false };
            }

            // Get opinions from all members
            for (const member of members) {
                await this.councilService.getMemberOpinion(member);
            }

            // Get moderator response
            if (moderator) {
                await this.councilService.getConsensus(moderator);
                
                const session = this.councilService.getSessionStatus();
                if (session?.finalPlan) {
                    LogUtils.print('\n📋 Council Review:', { color: colors.cyan });
                    LogUtils.print(session.finalPlan, { color: colors.green });
                    LogUtils.print('\n💡 Use /council accept to inject this review into conversation', { 
                        color: colors.yellow 
                    });
                }
            } else {
                LogUtils.warn('No moderator found. Create moderator.txt in council directory.');
                const session = this.councilService.getSessionStatus();
                if (session) {
                    LogUtils.print('\n📝 Council Member Opinions:', { color: colors.cyan });
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
            LogUtils.print('📋 Current Council Review:', { color: Config.colors.cyan });
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
        
        LogUtils.print('✅ Council plan injected into conversation', { color: Config.colors.green });
        LogUtils.print('💡 The AI will now consider this feedback in its response', { 
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

    private showHelp(): { shouldQuit: boolean; runApiCall: boolean } {
        const colors = Config.colors;
        
        LogUtils.print('🏛️ Council Command Help:', { color: colors.cyan });
        LogUtils.print('', { color: colors.white });
        LogUtils.print('Usage:', { color: colors.yellow });
        LogUtils.print('  /council                    Get opinions from all council members', { color: colors.white });
        LogUtils.print('  /council preidea,security  Get opinions from specific members only', { color: colors.white });
        LogUtils.print('  /council current            Show current council plan', { color: colors.white });
        LogUtils.print('  /council accept             Accept and inject plan into conversation', { color: colors.white });
        LogUtils.print('  /council clear              Clear current council session', { color: colors.white });
        LogUtils.print('  /council help               Show this help', { color: colors.white });
        LogUtils.print('', { color: colors.white });
        LogUtils.print('Council Directory:', { color: colors.yellow });
        LogUtils.print('  ~/.config/aicoder-mini/council/', { color: colors.white });
        LogUtils.print('', { color: colors.white });
        LogUtils.print('Member files should be named:', { color: colors.yellow });
        LogUtils.print('  preidea_simplicity_advocate.txt', { color: colors.white });
        LogUtils.print('  preimplementation_security.txt', { color: colors.white });
        LogUtils.print('  posimplementation_code_review.txt', { color: colors.white });
        LogUtils.print('  moderator.txt', { color: colors.white });
        
        return { shouldQuit: false, runApiCall: false };
    }
}