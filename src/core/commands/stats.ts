import { BaseCommand, CommandResult } from './base.js';

export class StatsCommand extends BaseCommand {
  protected name = 'stats';
  protected description = 'Show session statistics';

  execute(): CommandResult {
    this.context.stats.printStats();
    return { shouldQuit: false, runApiCall: false };
  }
}