import { fetchClaudeUsage } from "./providers/claude";
import { fetchCodexUsage } from "./providers/codex";
import { fetchCommandUsage } from "./providers/command";
import { fetchFileUsage } from "./providers/file";
import { fetchOpenCodeUsage } from "./providers/opencode";
import { ProviderConfig, ProviderResult } from "./types";
import { hasUsage } from "./usage";

const DEFAULT_REMOTE_POLL_SECONDS = 900;
const DEFAULT_ACCOUNT_POLL_SECONDS = 300;
const DEFAULT_COMMAND_POLL_SECONDS = 300;

interface CacheEntry {
  result: ProviderResult;
  fetchedAt: number;
  inFlight: boolean;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(provider: ProviderConfig): string {
  return `${provider.type}:${provider.name.toLowerCase()}`;
}

function emptyResult(provider: ProviderConfig): ProviderResult {
  return { name: provider.name, icon: provider.icon, color: provider.color };
}

/** Local files are cheap to re-read, so only remote/command providers are throttled. */
export function pollIntervalMs(provider: ProviderConfig): number {
  if (provider.type === "opencode") {
    return Math.max(30, provider.poll_seconds ?? DEFAULT_REMOTE_POLL_SECONDS) * 1000;
  }
  if (provider.type === "claude" || provider.type === "codex") {
    return Math.max(30, provider.poll_seconds ?? DEFAULT_ACCOUNT_POLL_SECONDS) * 1000;
  }
  if (provider.type === "command") {
    return Math.max(5, provider.poll_seconds ?? DEFAULT_COMMAND_POLL_SECONDS) * 1000;
  }
  return 0;
}

export function fetchProvider(provider: ProviderConfig): Promise<ProviderResult> {
  switch (provider.type) {
    case "file":
      return fetchFileUsage(provider);
    case "command":
      return fetchCommandUsage(provider);
    case "claude":
      return fetchClaudeUsage(provider);
    case "codex":
      return fetchCodexUsage(provider);
    case "opencode":
      return fetchOpenCodeUsage(provider);
  }
}

/** A failed refresh keeps the last good numbers instead of blanking the display. */
function withPrevious(key: string, result: ProviderResult): ProviderResult {
  const previous = cache.get(key)?.result;
  if (!hasUsage(result.usage) && previous && hasUsage(previous.usage)) {
    return { ...result, usage: previous.usage, error: undefined };
  }
  return result;
}

function refresh(provider: ProviderConfig): Promise<ProviderResult> {
  const key = cacheKey(provider);
  const entry = cache.get(key) ?? { result: emptyResult(provider), fetchedAt: 0, inFlight: false };
  entry.inFlight = true;
  cache.set(key, entry);

  return fetchProvider(provider)
    .catch((error) => ({
      ...emptyResult(provider),
      error: error instanceof Error ? error.message : String(error),
    }))
    .then((result) => {
      const merged = withPrevious(key, result);
      cache.set(key, { result: merged, fetchedAt: Date.now(), inFlight: false });
      return merged;
    });
}

function isStale(provider: ProviderConfig): boolean {
  const entry = cache.get(cacheKey(provider));
  return !entry || Date.now() - entry.fetchedAt >= pollIntervalMs(provider);
}

/** Non-blocking read for the pane view: serves cache and refreshes in the background. */
export function readCachedProvider(provider: ProviderConfig, onUpdate: () => void): ProviderResult {
  const key = cacheKey(provider);
  const entry = cache.get(key);

  if (isStale(provider) && !entry?.inFlight) {
    void refresh(provider).then(onUpdate, onUpdate);
  }

  return cache.get(key)?.result ?? { ...emptyResult(provider), error: "Loading…" };
}

/** Awaiting read used by the sidebar loop and one-shot rendering. */
export function getProviderResult(provider: ProviderConfig): Promise<ProviderResult> {
  if (pollIntervalMs(provider) === 0) {
    return fetchProvider(provider);
  }
  if (!isStale(provider)) {
    return Promise.resolve(cache.get(cacheKey(provider))!.result);
  }
  return refresh(provider);
}
