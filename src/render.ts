import { AIUsage, ProviderResult, UsageWindow } from "./types";
import { hasUsage } from "./usage";

const RESET = "\x1b[0m";
const DEFAULT_ICON = "●";
const DEFAULT_COLOR = 245;
const ERROR_COLOR = 203;

export function formatTimeRemaining(timestamp?: number): string {
  if (!timestamp) return "";

  const msRemaining = timestamp - Date.now();
  if (msRemaining <= 0) {
    return "0m";
  }

  const minutesRemaining = Math.floor(msRemaining / 60000);
  const hoursRemaining = Math.floor(minutesRemaining / 60);
  const daysRemaining = Math.floor(hoursRemaining / 24);

  if (daysRemaining > 0) {
    return `${daysRemaining}d`;
  }
  if (hoursRemaining > 0) {
    return `${hoursRemaining}h`;
  }
  if (minutesRemaining > 0) {
    return `${minutesRemaining}m`;
  }
  return "0m";
}

export function renderUsageBar(percentage: number, width: number = 10): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = Math.max(0, width - filled);
  return "█".repeat(Math.min(width, Math.max(0, filled))) + "░".repeat(empty);
}

function colorize(text: string, color: number): string {
  return `\x1b[38;5;${color}m${text}${RESET}`;
}

function formatWindow(label: string, window: UsageWindow): string {
  const percentage = Math.round(window.usage_percentage);
  const timeRemaining = formatTimeRemaining(window.reset_timestamp);
  return `${label}: ${renderUsageBar(window.usage_percentage)} ${percentage}% ${timeRemaining}`.trimEnd();
}

function formatWindows(usage: AIUsage): string {
  const parts: string[] = [];

  if (usage.session) parts.push(formatWindow("Session", usage.session));
  if (usage.weekly) parts.push(formatWindow("Weekly", usage.weekly));
  if (usage.monthly) parts.push(formatWindow("Monthly", usage.monthly));

  return parts.join("    ");
}

export function formatProvider(result: ProviderResult): string {
  const icon = colorize(result.icon || DEFAULT_ICON, result.color ?? DEFAULT_COLOR);
  const header = `${icon} ${result.name} usage`;

  if (hasUsage(result.usage)) {
    return `${header}\n${formatWindows(result.usage as AIUsage)}`;
  }

  return `${header}\n${colorize("⚠", ERROR_COLOR)} ${result.error ?? "No usage data"}`;
}

export function formatUsageDisplay(results: ProviderResult[], warning?: string): string {
  const robotIcon = colorize("𖠌", 255);
  const visible = results.filter((result) => hasUsage(result.usage) || result.error);

  const lines: string[] = [`${robotIcon} Your AI usage`];

  if (warning) {
    lines.push(`${colorize("⚠", ERROR_COLOR)} ${warning}`);
  }

  if (visible.length === 0) {
    lines.push("No agent usage detected");
  } else {
    lines.push(visible.map(formatProvider).join("\n\n"));
  }

  return lines.join("\n");
}
