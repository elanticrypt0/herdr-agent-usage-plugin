import * as fs from "fs";
import * as path from "path";

interface UsageData {
  session?: {
    usage_percentage: number;
    reset_timestamp?: number;
  };
  weekly?: {
    usage_percentage: number;
    reset_timestamp?: number;
  };
}

function getClaudeUsageDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return path.join(home, ".claude");
}

function readUsageData(): UsageData | null {
  try {
    const usageDir = getClaudeUsageDir();
    const usagePath = path.join(usageDir, "usage.json");

    if (!fs.existsSync(usagePath)) {
      return null;
    }

    const data = fs.readFileSync(usagePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

function formatTimeRemaining(timestamp?: number): string {
  if (!timestamp) return "";

  const now = Date.now();
  const msRemaining = timestamp - now;

  if (msRemaining <= 0) {
    return "0m";
  }

  const secondsRemaining = Math.floor(msRemaining / 1000);
  const minutesRemaining = Math.floor(secondsRemaining / 60);
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

function renderUsageBar(percentage: number, width: number = 10): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = Math.max(0, width - filled);
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return bar;
}

function formatUsageDisplay(usage: UsageData): string {
  const claudeIcon = "\x1b[38;5;208m✻\x1b[0m";
  const header = claudeIcon + " Your Claude usage";
  const usageParts: string[] = [];

  if (usage.session) {
    const sessionPct = Math.round(usage.session.usage_percentage);
    const sessionTime = formatTimeRemaining(usage.session.reset_timestamp);
    const sessionBar = renderUsageBar(usage.session.usage_percentage);
    usageParts.push(`Session: ${sessionBar} ${sessionPct}% ${sessionTime}`);
  }

  if (usage.weekly) {
    const weeklyPct = Math.round(usage.weekly.usage_percentage);
    const weeklyTime = formatTimeRemaining(usage.weekly.reset_timestamp);
    const weeklyBar = renderUsageBar(usage.weekly.usage_percentage);
    usageParts.push(`Weekly: ${weeklyBar} ${weeklyPct}% ${weeklyTime}`);
  }

  return header + "\n" + usageParts.join("    ");
}

function main(): void {
  const refreshInterval = 30000; // 30 seconds

  function display(): void {
    const usage = readUsageData();

    if (!usage || (!usage.session && !usage.weekly)) {
      console.log("No Claude usage detected");
      return;
    }

    const displayText = formatUsageDisplay(usage);
    console.clear();
    console.log(displayText);
  }

  display();
  setInterval(display, refreshInterval);
}

main();
