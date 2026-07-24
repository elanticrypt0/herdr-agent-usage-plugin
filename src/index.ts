import * as fs from "fs";
import * as path from "path";

interface AIUsage {
  session?: {
    usage_percentage: number;
    reset_timestamp?: number;
  };
  weekly?: {
    usage_percentage: number;
    reset_timestamp?: number;
  };
}

interface UsageData {
  claude?: AIUsage;
  codex?: AIUsage;
  gemini?: AIUsage;
}

function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || "";
}

function readAIUsage(aiName: string, dirName: string): AIUsage | undefined {
  try {
    const home = getHomeDir();
    const usagePath = path.join(home, dirName, "usage.json");

    if (!fs.existsSync(usagePath)) {
      return undefined;
    }

    const data = fs.readFileSync(usagePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return undefined;
  }
}

function readUsageData(): UsageData | null {
  const usage: UsageData = {};

  const claudeUsage = readAIUsage("claude", ".claude");
  if (claudeUsage) usage.claude = claudeUsage;

  const codexUsage = readAIUsage("codex", ".codex");
  if (codexUsage) usage.codex = codexUsage;

  const geminiUsage = readAIUsage("gemini", ".gemini");
  if (geminiUsage) usage.gemini = geminiUsage;

  if (Object.keys(usage).length === 0) {
    return null;
  }

  return usage;
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

function getAIIcon(aiName: string): string {
  const icons: Record<string, string> = {
    claude: "\x1b[38;5;208m✻\x1b[0m", // Orange starburst
    codex: "\x1b[38;5;135m֎\x1b[0m", // Purple ornament
    gemini: "\x1b[38;5;63m✦\x1b[0m", // Blue four-pointed star
  };
  return icons[aiName.toLowerCase()] || "●";
}

function formatAIUsage(aiName: string, aiUsage: AIUsage): string {
  const usageParts: string[] = [];

  if (aiUsage.session) {
    const sessionPct = Math.round(aiUsage.session.usage_percentage);
    const sessionTime = formatTimeRemaining(aiUsage.session.reset_timestamp);
    const sessionBar = renderUsageBar(aiUsage.session.usage_percentage);
    usageParts.push(`Session: ${sessionBar} ${sessionPct}% ${sessionTime}`);
  }

  if (aiUsage.weekly) {
    const weeklyPct = Math.round(aiUsage.weekly.usage_percentage);
    const weeklyTime = formatTimeRemaining(aiUsage.weekly.reset_timestamp);
    const weeklyBar = renderUsageBar(aiUsage.weekly.usage_percentage);
    usageParts.push(`Weekly: ${weeklyBar} ${weeklyPct}% ${weeklyTime}`);
  }

  const icon = getAIIcon(aiName);
  const header = `${icon} ${aiName} usage`;
  return header + "\n" + usageParts.join("    ");
}

function formatUsageDisplay(usage: UsageData): string {
  const robotIcon = "\x1b[38;5;255m𖠌\x1b[0m";
  const sections: string[] = [];

  const aiTools = [
    { key: "claude" as const, name: "Claude" },
    { key: "codex" as const, name: "Codex" },
    { key: "gemini" as const, name: "Gemini" },
  ];

  for (const tool of aiTools) {
    const toolUsage = usage[tool.key];
    if (toolUsage && (toolUsage.session || toolUsage.weekly)) {
      sections.push(formatAIUsage(tool.name, toolUsage));
    }
  }

  if (sections.length === 0) {
    return "No usage for Claude, Codex or Gemini detected";
  }

  const header = robotIcon + " Your AI usage";
  return header + "\n" + sections.join("\n\n");
}

function main(): void {
  const refreshInterval = 30000; // 30 seconds

  function display(): void {
    const usage = readUsageData();

    if (!usage) {
      console.log("No usage for Claude, Codex or Gemini detected");
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
