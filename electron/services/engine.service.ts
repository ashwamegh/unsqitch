import { SqitchService } from "./sqitch.service";

export interface EngineInfo {
  name: string;
  target: string;
  client?: string;
  registry?: string;
}

export class EngineService {
  constructor(private sqitch: SqitchService) {}

  async add(
    projectPath: string,
    name: string,
    uri: string,
    client?: string,
  ): Promise<void> {
    const args = ["engine", "add", name, "--target", uri];
    if (client) args.push("--client", client);
    await this.sqitch.runCommand(args, projectPath);
  }

  async remove(projectPath: string, name: string): Promise<void> {
    await this.sqitch.runCommand(["engine", "remove", name], projectPath);
  }

  async list(projectPath: string): Promise<EngineInfo[]> {
    const result = await this.sqitch.runCommand(
      ["engine", "list"],
      projectPath,
    );
    return this.parseEngineList(result.stdout);
  }

  private parseEngineList(output: string): EngineInfo[] {
    const engines: EngineInfo[] = [];
    const lines = output.split("\n");
    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)(?:\s+(.+))?$/);
      if (match) {
        engines.push({
          name: match[1],
          target: match[2],
        });
      }
    }
    return engines;
  }
}
