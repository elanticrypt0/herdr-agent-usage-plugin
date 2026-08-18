import { AIUsage, UsageWindow } from "./types";

const PERCENT_KEYS = [
  "usage_percentage",
  "usagePercent",
  "usage_percent",
  "used_percent",
  "usedPercent",
  "percent",
];

const RESET_AT_KEYS = ["reset_timestamp", "resetsAt", "reset_at", "resetTimestamp"];
const RESET_IN_KEYS = ["reset_in_sec", "resetInSec", "reset_in_seconds", "resets_in"];

const WINDOW_ALIASES: Record<keyof AIUsage, string[]> = {
  session: ["session", "rolling", "rollingUsage", "rolling_usage", "five_hour", "hourly"],
  weekly: ["weekly", "weeklyUsage", "weekly_usage", "week"],
  monthly: ["monthly", "monthlyUsage", "monthly_usage", "month"],
};

function pickNumber(source: Record<string, any>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function normalizeResetTimestamp(source: Record<string, any>): number | undefined {
  const inSeconds = pickNumber(source, RESET_IN_KEYS);
  if (inSeconds !== undefined) {
    return Date.now() + inSeconds * 1000;
  }

  const timestamp = pickNumber(source, RESET_AT_KEYS);
  if (timestamp === undefined) {
    return undefined;
  }

  // Values below 1e12 are seconds, not milliseconds.
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

function normalizeWindow(raw: unknown): UsageWindow | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const source = raw as Record<string, any>;
  const percentage = pickNumber(source, PERCENT_KEYS);
  if (percentage === undefined) {
    return undefined;
  }

  const window: UsageWindow = {
    usage_percentage: Math.min(100, Math.max(0, percentage)),
  };

  const resetTimestamp = normalizeResetTimestamp(source);
  if (resetTimestamp !== undefined) {
    window.reset_timestamp = resetTimestamp;
  }

  return window;
}

export function normalizeUsage(raw: unknown): AIUsage | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const source = raw as Record<string, any>;
  const usage: AIUsage = {};

  for (const key of Object.keys(WINDOW_ALIASES) as (keyof AIUsage)[]) {
    for (const alias of WINDOW_ALIASES[key]) {
      const window = normalizeWindow(source[alias]);
      if (window) {
        usage[key] = window;
        break;
      }
    }
  }

  return hasUsage(usage) ? usage : undefined;
}

export function hasUsage(usage?: AIUsage): boolean {
  return Boolean(usage && (usage.session || usage.weekly || usage.monthly));
}
