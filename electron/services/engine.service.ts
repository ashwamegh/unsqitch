import type { SqitchService } from "./sqitch.service";

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
    registry?: string,
  ): Promise<void> {
    const args = ["engine", "add", name, "--target", uri];
    if (client) args.push("--client", client);
    if (registry) args.push("--registry", registry);
    await this.sqitch.runCommand(args, projectPath);
  }

  async remove(projectPath: string, name: string): Promise<void> {
    await this.sqitch.runCommand(["engine", "remove", name], projectPath);
  }

  async list(projectPath: string): Promise<EngineInfo[]> {
    // `engine list` prints only the engine name; --verbose adds the target,
    // tab-separated ("pg\tdb:pg://...").
    const result = await this.sqitch.runCommand(["engine", "list", "--verbose"], projectPath);
    return this.parseEngineList(result.stdout);
  }

  parseEngineList(output: string): EngineInfo[] {
    const engines: EngineInfo[] = [];
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      const [name, target] = trimmed.split(/\s+/, 2);
      if (!name) continue;
      engines.push({ name, target: target ?? "" });
    }
    return engines;
  }
}
