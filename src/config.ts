import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { PluginConfig, ProviderConfig, SidebarConfig, SidebarFormat, SidebarPrimary } from "./types";

const DEFAULT_REFRESH_SECONDS = 30;

const DEFAULT_SIDEBAR: SidebarConfig = {
  enabled: true,
  interval_seconds: 60,
  token: "usage",
  format: "compact",
  primary: "session",
  bar_width: 5,
  show_reset: false,
  workspace_token: null,
};

const SIDEBAR_FORMATS: SidebarFormat[] = ["compact", "bar", "percent"];
const SIDEBAR_PRIMARIES: SidebarPrimary[] = ["session", "weekly", "monthly", "max"];

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  { type: "claude", name: "Claude", icon: "✻", color: 208 },
  { type: "codex", name: "Codex", icon: "֎", color: 135 },
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
  const names = ["agents-usage.json", "agent-usage.json"];
  return [
    ...names.map((name) => path.join(configHome, "herdr", name)),
    ...names.map((name) => path.join(getHomeDir(), ".herdr", name)),
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
  return ["file", "command", "claude", "codex", "opencode"].includes(provider.type);
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

function mergeSidebar(configured: unknown): SidebarConfig {
  const raw = (configured ?? {}) as Partial<SidebarConfig>;
  const format = SIDEBAR_FORMATS.includes(raw.format as SidebarFormat)
    ? (raw.format as SidebarFormat)
    : DEFAULT_SIDEBAR.format;

  const primary = SIDEBAR_PRIMARIES.includes(raw.primary as SidebarPrimary)
    ? (raw.primary as SidebarPrimary)
    : DEFAULT_SIDEBAR.primary;

  return {
    enabled: raw.enabled !== false,
    interval_seconds:
      typeof raw.interval_seconds === "number" && raw.interval_seconds >= 5
        ? raw.interval_seconds
        : DEFAULT_SIDEBAR.interval_seconds,
    token: typeof raw.token === "string" && raw.token.trim() ? raw.token.trim() : DEFAULT_SIDEBAR.token,
    format,
    primary,
    bar_width:
      typeof raw.bar_width === "number" && raw.bar_width >= 1 && raw.bar_width <= 20
        ? Math.round(raw.bar_width)
        : DEFAULT_SIDEBAR.bar_width,
    show_reset: raw.show_reset === true,
    workspace_token:
      typeof raw.workspace_token === "string" && raw.workspace_token.trim()
        ? raw.workspace_token.trim()
        : null,
  };
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
      sidebar: mergeSidebar((config as Record<string, unknown>).sidebar),
    },
    error,
  };
}
