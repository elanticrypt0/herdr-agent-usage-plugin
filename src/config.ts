import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { PluginConfig, ProviderConfig } from "./types";

const DEFAULT_REFRESH_SECONDS = 30;

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  { type: "file", name: "Claude", path: "~/.claude/usage.json", icon: "✻", color: 208 },
  { type: "file", name: "Codex", path: "~/.codex/usage.json", icon: "֎", color: 135 },
  { type: "file", name: "Gemini", path: "~/.gemini/usage.json", icon: "✦", color: 63 },
];

export function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || os.homedir() || "";
}

export function expandHome(filePath: string): string {
  if (filePath === "~") {
    return getHomeDir();
  }
  if (filePath.startsWith("~/") || filePath.startsWith("~\\")) {
    return path.join(getHomeDir(), filePath.slice(2));
  }
  return filePath;
}

function configCandidates(): string[] {
  const explicit = process.env.HERDR_AGENT_USAGE_CONFIG;
  if (explicit) {
    return [expandHome(explicit)];
  }

  const configHome = process.env.XDG_CONFIG_HOME || path.join(getHomeDir(), ".config");
  return [
    path.join(configHome, "herdr", "agent-usage.json"),
    path.join(getHomeDir(), ".herdr", "agent-usage.json"),
  ];
}

export function getConfigPath(): string | null {
  for (const candidate of configCandidates()) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function readConfigFile(): { config: Partial<PluginConfig>; error?: string } {
  const configPath = getConfigPath();
  if (!configPath) {
    return { config: {} };
  }

  try {
    return { config: JSON.parse(fs.readFileSync(configPath, "utf-8")) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { config: {}, error: `Invalid config at ${configPath}: ${message}` };
  }
}

function providerKey(provider: ProviderConfig): string {
  return provider.name.trim().toLowerCase();
}

function isSupported(provider: ProviderConfig): boolean {
  if (!provider || typeof provider.name !== "string" || !provider.name.trim()) {
    return false;
  }
  return provider.type === "file" || provider.type === "command" || provider.type === "opencode";
}

/** Type-level fallbacks so a minimal config entry still gets a proper icon. */
function applyTypeDefaults(provider: ProviderConfig): ProviderConfig {
  if (provider.type === "opencode") {
    return { icon: "◆", color: 250, ...provider };
  }
  return provider;
}

function openCodeFromEnv(): ProviderConfig | null {
  const cookie = process.env.HERDR_OPENCODE_COOKIE;
  if (!cookie) {
    return null;
  }

  return {
    type: "opencode",
    name: "OpenCode",
    cookie,
    workspace_id: process.env.HERDR_OPENCODE_WORKSPACE_ID,
  };
}

/**
 * Built-in providers are always present; entries in the config file are merged
 * on top of them by name, so a config entry can override an icon, point a
 * built-in at another path, or disable it with `"enabled": false`.
 */
function mergeProviders(configured: unknown): ProviderConfig[] {
  const merged = new Map<string, ProviderConfig>();

  for (const provider of DEFAULT_PROVIDERS) {
    merged.set(providerKey(provider), provider);
  }

  if (Array.isArray(configured)) {
    for (const raw of configured) {
      const provider = raw as ProviderConfig;
      if (!isSupported(provider)) {
        continue;
      }
      const key = providerKey(provider);
      const base = merged.get(key);
      merged.set(
        key,
        applyTypeDefaults(base && base.type === provider.type ? { ...base, ...provider } : provider)
      );
    }
  }

  const fromEnv = openCodeFromEnv();
  if (fromEnv && !merged.has(providerKey(fromEnv))) {
    merged.set(providerKey(fromEnv), applyTypeDefaults(fromEnv));
  }

  return Array.from(merged.values()).filter((provider) => provider.enabled !== false);
}

export function loadConfig(): { config: PluginConfig; error?: string } {
  const { config, error } = readConfigFile();

  const refreshSeconds =
    typeof config.refresh_seconds === "number" && config.refresh_seconds >= 5
      ? config.refresh_seconds
      : DEFAULT_REFRESH_SECONDS;

  return {
    config: {
      refresh_seconds: refreshSeconds,
      providers: mergeProviders(config.providers),
    },
    error,
  };
}
