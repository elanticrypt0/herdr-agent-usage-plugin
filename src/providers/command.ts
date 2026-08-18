import { execFile } from "child_process";
import { CommandProviderConfig, ProviderResult } from "../types";
import { normalizeUsage } from "../usage";

const DEFAULT_TIMEOUT_MS = 15000;

function runCommand(config: CommandProviderConfig): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      config.command,
      config.args ?? [],
      {
        timeout: config.timeout_ms ?? DEFAULT_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
        shell: config.args === undefined,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      }
    );
  });
}

export async function fetchCommandUsage(config: CommandProviderConfig): Promise<ProviderResult> {
  const result: ProviderResult = {
    name: config.name,
    icon: config.icon,
    color: config.color,
  };

  try {
    const stdout = await runCommand(config);
    result.usage = normalizeUsage(JSON.parse(stdout));
    if (!result.usage) {
      result.error = "Command output has no usage windows";
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}
