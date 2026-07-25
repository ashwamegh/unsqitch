import type { SqitchService } from "./sqitch.service";

export interface TargetInfo {
  name: string;
  uri: string;
}

export class TargetService {
  constructor(private sqitch: SqitchService) {}

  async add(projectPath: string, name: string, uri: string): Promise<void> {
    // Real sqitch takes the URI positionally: `sqitch target add <name> <uri>`.
    // Passing it as --uri is a usage error (exit 2).
    await this.sqitch.runCommand(["target", "add", name, uri], projectPath);
  }

  async remove(projectPath: string, name: string): Promise<void> {
    await this.sqitch.runCommand(["target", "remove", name], projectPath);
  }

  async list(projectPath: string): Promise<TargetInfo[]> {
    // `target list` prints only the target name; --verbose adds the URI,
    // tab-separated ("staging\tdb:pg://...").
    const result = await this.sqitch.runCommand(["target", "list", "--verbose"], projectPath);
    return this.parseTargetList(result.stdout);
  }

  parseTargetList(output: string): TargetInfo[] {
    const targets: TargetInfo[] = [];
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      const [name, uri] = trimmed.split(/\s+/, 2);
      if (!name) continue;
      targets.push({ name, uri: uri ?? "" });
    }
    return targets;
  }
}
