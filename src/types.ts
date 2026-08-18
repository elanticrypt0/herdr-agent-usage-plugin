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
  | OpenCodeProviderConfig;

export interface PluginConfig {
  refresh_seconds: number;
  providers: ProviderConfig[];
}
