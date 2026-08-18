import * as fs from "fs";
import * as path from "path";
import { expandHome, getHomeDir } from "../config";
import { AIUsage, ClaudeProviderConfig, ProviderResult, UsageWindow } from "../types";
import { normalizeUsage } from "../usage";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const OAUTH_BETA_HEADER = "oauth-2025-04-20";
const USER_AGENT = "claude-code/2.1.0";
const DEFAULT_TIMEOUT_MS = 15000;

function configDir(config: ClaudeProviderConfig): string {
  const configured = config.config_dir || process.env.CLAUDE_CONFIG_DIR;
  return configured ? expandHome(configured) : path.join(getHomeDir(), ".claude");
}

function readAccessToken(dir: string): string | null {
  try {
    const raw = fs.readFileSync(path.join(dir, ".credentials.json"), "utf-8");
    const token = JSON.parse(raw)?.claudeAiOauth?.accessToken;
    return typeof token === "string" && token ? token : null;
  } catch {
    return null;
  }
}

function toWindow(raw: any): UsageWindow | undefined {
  const percentage = typeof raw?.utilization === "number" ? raw.utilization : raw?.used_percentage;
  if (typeof percentage !== "number" || !Number.isFinite(percentage)) {
    return undefined;
  }

  const window: UsageWindow = {
    usage_percentage: Math.min(100, Math.max(0, percentage)),
  };

  const resetsAt = Date.parse(raw?.resets_at ?? "");
  if (Number.isFinite(resetsAt)) {
    window.reset_timestamp = resetsAt;
  }

  return window;
}

/** Legacy path: a usage.json written by some other tool. */
function readLocalFallback(dir: string): AIUsage | undefined {
  try {
    return normalizeUsage(JSON.parse(fs.readFileSync(path.join(dir, "usage.json"), "utf-8")));
  } catch {
    return undefined;
  }
}

export async function fetchClaudeUsage(config: ClaudeProviderConfig): Promise<ProviderResult> {
  const result: ProviderResult = { name: config.name, icon: config.icon, color: config.color };
  const dir = configDir(config);
  const token = readAccessToken(dir);

  if (!token) {
    const fallback = readLocalFallback(dir);
    if (fallback) {
      result.usage = fallback;
    } else {
      result.error = "Not signed in — no OAuth credentials in ~/.claude";
    }
    return result;
  }

  try {
    const response = await fetch(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        "anthropic-beta": OAUTH_BETA_HEADER,
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(config.timeout_ms ?? DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      result.error =
        response.status === 401
          ? "Credentials expired — run Claude Code once to refresh them"
          : `Usage fetch failed (${response.status})`;
      return result;
    }

    const data: any = await response.json();
    const usage: AIUsage = {};
    const session = toWindow(data?.five_hour);
    const weekly = toWindow(data?.seven_day);

    if (session) usage.session = session;
    if (weekly) usage.weekly = weekly;

    if (!session && !weekly) {
      result.error = "Usage response had no five_hour or seven_day window";
      return result;
    }

    result.usage = usage;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}
