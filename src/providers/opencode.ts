import { randomUUID } from "crypto";
import * as fs from "fs";
import { expandHome } from "../config";
import { AIUsage, OpenCodeProviderConfig, ProviderResult, UsageWindow } from "../types";

const BASE_URL = "https://opencode.ai";
const SERVER_URL = `${BASE_URL}/_server`;
// Server function id of the workspace list endpoint on opencode.ai.
const WORKSPACES_SERVER_ID = "def39973159c7f0483d8793a822b8dbb10d067e12c65455fcb4608459ba0234f";
const AUTH_COOKIE_NAMES = new Set(["auth", "__Host-auth"]);
const WORKSPACE_ID_PATTERN = /^(wrk|wk)_[A-Za-z0-9]+$/;
const DEFAULT_TIMEOUT_MS = 15000;
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function resolveCookie(config: OpenCodeProviderConfig): string {
  if (config.cookie_file) {
    try {
      const fromFile = fs.readFileSync(expandHome(config.cookie_file), "utf-8").trim();
      if (fromFile) {
        return fromFile;
      }
    } catch {
      // Fall through to the other cookie sources.
    }
  }

  if (config.cookie_env) {
    const fromEnv = process.env[config.cookie_env];
    if (fromEnv) {
      return fromEnv.trim();
    }
  }

  return (config.cookie ?? "").trim();
}

/** Accepts a bare cookie value, a `auth=...` pair, or a full Cookie header. */
function normalizeCookieInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.includes(";") || /^(?:auth|__Host-auth)=/i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("Fe26.2**") || /^[a-zA-Z0-9.\-_]+$/.test(trimmed)) {
    return `auth=${trimmed}`;
  }
  return trimmed;
}

function buildCookieHeader(raw: string): string {
  const pairs = normalizeCookieInput(raw)
    .split(";")
    .map((part) => part.trim())
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq === -1) {
        return null;
      }
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      return AUTH_COOKIE_NAMES.has(name) && value ? `${name}=${value}` : null;
    })
    .filter((pair): pair is string => pair !== null);

  return pairs.join("; ");
}

function parseWorkspaceIds(text: string): string[] {
  const ids: string[] = [];
  for (const match of text.matchAll(/\bid\s*:\s*["']((?:wrk|wk)_[a-zA-Z0-9]+)["']/g)) {
    if (!ids.includes(match[1])) {
      ids.push(match[1]);
    }
  }
  return ids;
}

/**
 * The usage page ships its data inside a serialized JS payload, so the numbers
 * are read out of the `rollingUsage` / `weeklyUsage` / `monthlyUsage` objects
 * instead of a JSON API response.
 */
function extractUsageBlock(text: string, key: string): string | null {
  const keyRegex = new RegExp(`\\b${key}\\b\\s*:`, "g");
  let keyMatch: RegExpExecArray | null;

  while ((keyMatch = keyRegex.exec(text)) !== null) {
    const searchStart = keyMatch.index + keyMatch[0].length;
    const braceOffset = text.slice(searchStart, searchStart + 30).indexOf("{");
    if (braceOffset === -1) {
      continue;
    }

    const openBrace = searchStart + braceOffset;
    let depth = 0;
    let block: string | null = null;

    for (let i = openBrace; i < text.length; i++) {
      if (text[i] === "{") {
        depth++;
      } else if (text[i] === "}") {
        depth--;
        if (depth === 0) {
          block = text.slice(openBrace, i + 1);
          break;
        }
      }
    }

    if (block && extractTopLevelNumber(block, "usagePercent") !== null && extractTopLevelNumber(block, "resetInSec") !== null) {
      return block;
    }
  }

  return null;
}

function extractTopLevelNumber(objText: string, fieldName: string): number | null {
  const fieldRegex = new RegExp(`\\b${fieldName}\\b\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)`);
  let depth = 0;

  for (let i = 0; i < objText.length; i++) {
    const ch = objText[i];
    if (ch === "{") {
      depth++;
      continue;
    }
    if (ch === "}") {
      depth--;
      continue;
    }
    if (depth === 1) {
      const match = fieldRegex.exec(objText.slice(i, i + fieldName.length + 30));
      if (match && match.index === 0) {
        const value = Number.parseFloat(match[1]);
        return Number.isFinite(value) ? value : null;
      }
    }
  }

  return null;
}

function toWindow(block: string | null): UsageWindow | undefined {
  if (!block) {
    return undefined;
  }

  const percent = extractTopLevelNumber(block, "usagePercent");
  const resetInSec = extractTopLevelNumber(block, "resetInSec");
  if (percent === null || resetInSec === null) {
    return undefined;
  }

  return {
    usage_percentage: Math.min(100, Math.max(0, percent)),
    reset_timestamp: Date.now() + resetInSec * 1000,
  };
}

function parseUsagePage(text: string): AIUsage | undefined {
  if (!text || text.length > 1e7) {
    return undefined;
  }

  const session = toWindow(extractUsageBlock(text, "rollingUsage"));
  const weekly = toWindow(extractUsageBlock(text, "weeklyUsage"));
  const monthly = toWindow(extractUsageBlock(text, "monthlyUsage"));

  if (!session && !weekly && !monthly) {
    return undefined;
  }

  const usage: AIUsage = {};
  if (session) usage.session = session;
  if (weekly) usage.weekly = weekly;
  if (monthly) usage.monthly = monthly;
  return usage;
}

function request(url: string, cookieHeader: string, timeoutMs: number, extraHeaders: Record<string, string> = {}) {
  return fetch(url, {
    method: "GET",
    headers: {
      Cookie: cookieHeader,
      Origin: BASE_URL,
      Referer: BASE_URL,
      "User-Agent": USER_AGENT,
      ...extraHeaders,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function discoverWorkspaceIds(cookieHeader: string, timeoutMs: number): Promise<string[]> {
  const response = await request(`${SERVER_URL}?id=${WORKSPACES_SERVER_ID}`, cookieHeader, timeoutMs, {
    "X-Server-Id": WORKSPACES_SERVER_ID,
    "X-Server-Instance": `server-fn:${randomUUID()}`,
    Accept: "text/javascript, application/json;q=0.9, */*;q=0.8",
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Session cookie rejected — copy a fresh one from opencode.ai"
        : `Workspaces fetch failed (${response.status})`
    );
  }

  return parseWorkspaceIds(await response.text());
}

export async function fetchOpenCodeUsage(config: OpenCodeProviderConfig): Promise<ProviderResult> {
  const result: ProviderResult = {
    name: config.name,
    icon: config.icon,
    color: config.color,
  };

  const timeoutMs = config.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const rawCookie = resolveCookie(config);

  if (!rawCookie) {
    result.error = "Session cookie not configured";
    return result;
  }

  const cookieHeader = buildCookieHeader(rawCookie);
  if (!cookieHeader) {
    result.error = "No auth cookie found — paste the full Cookie header from opencode.ai";
    return result;
  }

  let workspaceIds: string[];
  const override = config.workspace_id?.trim();

  if (override) {
    if (!WORKSPACE_ID_PATTERN.test(override)) {
      result.error = "Invalid workspace ID — expected wrk_… or wk_…";
      return result;
    }
    workspaceIds = [override];
  } else {
    try {
      workspaceIds = await discoverWorkspaceIds(cookieHeader, timeoutMs);
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  if (workspaceIds.length === 0) {
    result.error = "No workspace found — set workspace_id in the config";
    return result;
  }

  let lastError = "";

  for (const workspaceId of workspaceIds) {
    try {
      const response = await request(`${BASE_URL}/workspace/${workspaceId}/go`, cookieHeader, timeoutMs, {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      });

      if (!response.ok) {
        lastError = `Usage page fetch failed (${response.status})`;
        continue;
      }

      const usage = parseUsagePage(await response.text());
      if (usage) {
        result.usage = usage;
        return result;
      }

      lastError = "Could not parse usage data from page";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  result.error = lastError || "Could not parse usage data from any workspace";
  return result;
}
