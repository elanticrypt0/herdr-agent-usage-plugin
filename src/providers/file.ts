import * as fs from "fs";
import { expandHome } from "../config";
import { FileProviderConfig, ProviderResult } from "../types";
import { normalizeUsage } from "../usage";

export async function fetchFileUsage(config: FileProviderConfig): Promise<ProviderResult> {
  const result: ProviderResult = {
    name: config.name,
    icon: config.icon,
    color: config.color,
  };

  const usagePath = expandHome(config.path);

  try {
    if (!fs.existsSync(usagePath)) {
      return result;
    }
    result.usage = normalizeUsage(JSON.parse(fs.readFileSync(usagePath, "utf-8")));
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}
