export interface UsageWindow {
  usage_percentage: number;
  reset_timestamp?: number;
}

export interface AIUsage {
  session?: UsageWindow;
  weekly?: UsageWindow;
  monthly?: UsageWindow;
}

export interface ProviderResult {
  name: string;
  icon?: string;
  color?: number;
  usage?: AIUsage;
  error?: string;
}

interface BaseProviderConfig {
  name: string;
  icon?: string;
  color?: number;
  enabled?: boolean;
  /** Herdr agent id(s) this provider maps to in the sidebar, e.g. "open_code". */
  agent?: string | string[];
}

export interface FileProviderConfig extends BaseProviderConfig {
  type: "file";
  path: string;
}

export interface CommandProviderConfig extends BaseProviderConfig {
  type: "command";
  command: string;
  args?: string[];
  poll_seconds?: number;
  timeout_ms?: number;
}

export interface ClaudeProviderConfig extends BaseProviderConfig {
  type: "claude";
  /** Defaults to $CLAUDE_CONFIG_DIR or ~/.claude. */
  config_dir?: string;
  poll_seconds?: number;
  timeout_ms?: number;
}

export interface CodexProviderConfig extends BaseProviderConfig {
  type: "codex";
  /** Defaults to $CODEX_HOME or ~/.codex. */
  codex_home?: string;
  poll_seconds?: number;
  timeout_ms?: number;
}

export interface OpenCodeProviderConfig extends BaseProviderConfig {
  type: "opencode";
  cookie?: string;
  cookie_file?: string;
  cookie_env?: string;
  workspace_id?: string;
  poll_seconds?: number;
  timeout_ms?: number;
}

export type ProviderConfig =
  | FileProviderConfig
  | CommandProviderConfig
  | ClaudeProviderConfig
  | CodexProviderConfig
  | OpenCodeProviderConfig;

export type SidebarFormat = "compact" | "bar" | "percent";

/** Which window the bar and the summary highlight. "max" picks the fullest one. */
export type SidebarPrimary = "session" | "weekly" | "monthly" | "max";

export interface SidebarConfig {
  enabled: boolean;
  interval_seconds: number;
  token: string;
  format: SidebarFormat;
  primary: SidebarPrimary;
  bar_width: number;
  show_reset: boolean;
  /** When set, a summary of every provider is pushed as a workspace token too. */
  workspace_token: string | null;
}

export interface PluginConfig {
  refresh_seconds: number;
  providers: ProviderConfig[];
  sidebar: SidebarConfig;
}
