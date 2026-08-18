import { AIUsage, ProviderResult, SidebarConfig, UsageWindow } from "./types";
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

/**
 * Sidebar tokens share a row with other tokens in a column that is often 26
 * cells wide, so they stay short and carry no ANSI codes — styling is done in
 * herdr's config with { token = "$usage", fg = "…" }.
 */
function pickPrimaryWindow(usage: AIUsage, sidebar: SidebarConfig): UsageWindow | undefined {
  const available = [usage.session, usage.weekly, usage.monthly].filter(
    (window): window is UsageWindow => Boolean(window)
  );

  if (available.length === 0) {
    return undefined;
  }
  if (sidebar.primary === "max") {
    return available.reduce((a, b) => (b.usage_percentage > a.usage_percentage ? b : a));
  }

  return usage[sidebar.primary] ?? available[0];
}

export function formatSidebarToken(usage: AIUsage, sidebar: SidebarConfig): string | null {
  const session = usage.session;
  const weekly = usage.weekly;
  const primary = pickPrimaryWindow(usage, sidebar);

  if (!primary) {
    return null;
  }

  const percent = (window: UsageWindow) => `${Math.round(window.usage_percentage)}%`;
  const reset = sidebar.show_reset ? formatTimeRemaining(primary.reset_timestamp) : "";

  let text: string;
  switch (sidebar.format) {
    case "bar":
      // Only the primary window: a bar plus every percentage does not fit a
      // sidebar column.
      text = `${renderUsageBar(primary.usage_percentage, sidebar.bar_width)} ${percent(primary)}`;
      break;
    case "percent":
      text = [session, weekly, usage.monthly]
        .filter((window): window is UsageWindow => Boolean(window))
        .map(percent)
        .join("/");
      break;
    default:
      text = [
        session ? `S ${percent(session)}` : "",
        weekly ? `W ${percent(weekly)}` : "",
        usage.monthly ? `M ${percent(usage.monthly)}` : "",
      ]
        .filter(Boolean)
        .join(" ");
  }

  return reset ? `${text} ${reset}` : text;
}

/** One-line summary of every provider, for the optional workspace token. */
export function formatSidebarSummary(results: ProviderResult[], sidebar: SidebarConfig): string | null {
  const parts = results
    .filter((result) => hasUsage(result.usage))
    .map((result) => {
      const window = pickPrimaryWindow(result.usage!, sidebar)!;
      return `${result.icon || DEFAULT_ICON}${Math.round(window.usage_percentage)}%`;
    });

  return parts.length > 0 ? parts.join(" ") : null;
}
