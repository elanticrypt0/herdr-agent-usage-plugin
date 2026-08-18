import * as fs from "fs";
import * as path from "path";
import { expandHome, getHomeDir } from "../config";
import { AIUsage, CodexProviderConfig, ProviderResult, UsageWindow } from "../types";
import { normalizeUsage } from "../usage";

const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const DEFAULT_TIMEOUT_MS = 15000;
const SESSION_WINDOW_MINUTES = 300;
const WEEKLY_WINDOW_MINUTES = 10080;
const WINDOW_TOLERANCE_MINUTES = 1;

interface CodexAuthHeaders {
  Authorization: string;
  [header: string]: string;
}

function codexHome(config: CodexProviderConfig): string {
  const configured = config.codex_home || process.env.CODEX_HOME;
  return configured ? expandHome(configured) : path.join(getHomeDir(), ".codex");
}

function readAuthHeaders(home: string): CodexAuthHeaders | null {
  try {
    const tokens = JSON.parse(fs.readFileSync(path.join(home, "auth.json"), "utf-8"))?.tokens;
    const accessToken = tokens?.access_token;
    if (typeof accessToken !== "string" || !accessToken) {
      return null;
    }

    const headers: CodexAuthHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "codex-cli",
      "OpenAI-Beta": "codex-1",
      originator: "Codex Desktop",
    };
    if (typeof tokens.account_id === "string" && tokens.account_id) {
      headers["ChatGPT-Account-Id"] = tokens.account_id;
    }
    return headers;
  } catch {
    return null;
  }
}

function windowMinutes(raw: any): number | null {
  const seconds = raw?.limit_window_seconds;
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds / 60)
    : null;
}

function toWindow(raw: any): UsageWindow | undefined {
  const percentage = raw?.used_percent;
  if (typeof percentage !== "number" || !Number.isFinite(percentage)) {
    return undefined;
  }

  const window: UsageWindow = {
    usage_percentage: Math.min(100, Math.max(0, percentage)),
  };

  if (typeof raw.reset_at === "number" && Number.isFinite(raw.reset_at) && raw.reset_at > 0) {
    window.reset_timestamp = raw.reset_at * 1000;
  } else if (typeof raw.reset_after_seconds === "number" && Number.isFinite(raw.reset_after_seconds)) {
    window.reset_timestamp = Date.now() + raw.reset_after_seconds * 1000;
  }

  return window;
}

/**
 * Codex reports a primary and a secondary window whose meaning depends on the
 * plan, so they are classified by their declared duration (5h vs 7d) and only
 * fall back to positional order when the duration is missing.
 */
function classifyWindows(primary: any, secondary: any): AIUsage {
  const usage: AIUsage = {};

  for (const raw of [primary, secondary]) {
    const window = toWindow(raw);
    if (!window) {
      continue;
    }

    const minutes = windowMinutes(raw);
    if (minutes !== null && Math.abs(minutes - SESSION_WINDOW_MINUTES) <= WINDOW_TOLERANCE_MINUTES) {
      usage.session = usage.session ?? window;
    } else if (minutes !== null && Math.abs(minutes - WEEKLY_WINDOW_MINUTES) <= WINDOW_TOLERANCE_MINUTES) {
      usage.weekly = usage.weekly ?? window;
    } else if (minutes === null) {
      if (raw === primary) {
        usage.session = usage.session ?? window;
      } else {
        usage.weekly = usage.weekly ?? window;
      }
    }
  }

  return usage;
}

function readLocalFallback(home: string): AIUsage | undefined {
  try {
    return normalizeUsage(JSON.parse(fs.readFileSync(path.join(home, "usage.json"), "utf-8")));
  } catch {
    return undefined;
  }
}

export async function fetchCodexUsage(config: CodexProviderConfig): Promise<ProviderResult> {
  const result: ProviderResult = { name: config.name, icon: config.icon, color: config.color };
  const home = codexHome(config);
  const headers = readAuthHeaders(home);

  if (!headers) {
    const fallback = readLocalFallback(home);
    if (fallback) {
      result.usage = fallback;
    } else {
      result.error = "Not signed in — no tokens in ~/.codex/auth.json";
    }
    return result;
  }

  try {
    const response = await fetch(USAGE_URL, {
      headers,
      signal: AbortSignal.timeout(config.timeout_ms ?? DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      result.error =
        response.status === 401
          ? "Credentials expired — run `codex login` to refresh them"
          : `Usage fetch failed (${response.status})`;
      return result;
    }

    const data: any = await response.json();
    const usage = classifyWindows(data?.rate_limit?.primary_window, data?.rate_limit?.secondary_window);

    if (!usage.session && !usage.weekly) {
      result.error = "Usage response had no rate limit window";
      return result;
    }

    result.usage = usage;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}
