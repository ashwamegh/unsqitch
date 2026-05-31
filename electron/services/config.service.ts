import { SqitchService } from "./sqitch.service";
import { parseConfigList } from "../../src/lib/config-parser";
import type { ConfigEntry } from "../../src/types/config";

export class ConfigService {
  constructor(private sqitch: SqitchService) {}

  async list(projectPath: string): Promise<ConfigEntry[]> {
    const result = await this.sqitch.runCommand(
      ["config", "--list"],
      projectPath,
    );
    return parseConfigList(result.stdout);
  }

  async set(projectPath: string, key: string, value: string): Promise<void> {
    await this.sqitch.runCommand(["config", key, value], projectPath);
  }

  async unset(projectPath: string, key: string): Promise<void> {
    await this.sqitch.runCommand(["config", "--unset", key], projectPath);
  }
}
