import { SqitchService } from './sqitch.service';

export interface TargetInfo {
  name: string;
  uri: string;
}

export class TargetService {
  constructor(private sqitch: SqitchService) {}

  async add(projectPath: string, name: string, uri: string): Promise<void> {
    await this.sqitch.runCommand(['target', 'add', name, '--uri', uri], projectPath);
  }

  async remove(projectPath: string, name: string): Promise<void> {
    await this.sqitch.runCommand(['target', 'remove', name], projectPath);
  }

  async list(projectPath: string): Promise<TargetInfo[]> {
    const result = await this.sqitch.runCommand(['target', 'list'], projectPath);
    return this.parseTargetList(result.stdout);
  }

  private parseTargetList(output: string): TargetInfo[] {
    const targets: TargetInfo[] = [];
    const lines = output.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)$/);
      if (match) {
        targets.push({ name: match[1], uri: match[2] });
      }
    }
    return targets;
  }
}
