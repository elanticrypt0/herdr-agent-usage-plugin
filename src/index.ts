import { getConfigPath, loadConfig } from "./config";
import { fetchCommandUsage } from "./providers/command";
import { fetchFileUsage } from "./providers/file";
import { fetchOpenCodeUsage } from "./providers/opencode";
import { formatUsageDisplay } from "./render";
import { PluginConfig, ProviderConfig, ProviderResult } from "./types";
import { hasUsage } from "./usage";

const DEFAULT_REMOTE_POLL_SECONDS = 900;
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

function pollIntervalMs(provider: ProviderConfig): number {
  if (provider.type === "opencode") {
    return Math.max(30, provider.poll_seconds ?? DEFAULT_REMOTE_POLL_SECONDS) * 1000;
  }
  if (provider.type === "command") {
    return Math.max(5, provider.poll_seconds ?? DEFAULT_COMMAND_POLL_SECONDS) * 1000;
  }
  return 0;
}

function fetchProvider(provider: ProviderConfig): Promise<ProviderResult> {
  switch (provider.type) {
    case "file":
      return fetchFileUsage(provider);
    case "command":
      return fetchCommandUsage(provider);
    case "opencode":
      return fetchOpenCodeUsage(provider);
  }
}

/**
 * Remote and command providers are polled on their own (slower) schedule and
 * served from cache in between, so the pane can keep refreshing every few
 * seconds without hammering opencode.ai. A failed refresh keeps the last good
 * numbers instead of blanking the pane.
 */
function readCached(provider: ProviderConfig, onUpdate: () => void): ProviderResult {
  const key = cacheKey(provider);
  const entry = cache.get(key);
  const isStale = !entry || Date.now() - entry.fetchedAt >= pollIntervalMs(provider);

  if (isStale && !entry?.inFlight) {
    const pending: CacheEntry = entry ?? {
      result: { name: provider.name, icon: provider.icon, color: provider.color },
      fetchedAt: 0,
      inFlight: true,
    };
    pending.inFlight = true;
    cache.set(key, pending);

    fetchProvider(provider)
      .then((result) => {
        const previous = cache.get(key)?.result;
        if (!hasUsage(result.usage) && previous && hasUsage(previous.usage)) {
          result.usage = previous.usage;
          result.error = undefined;
        }
        cache.set(key, { result, fetchedAt: Date.now(), inFlight: false });
      })
      .catch((error) => {
        const previous = cache.get(key)?.result;
        cache.set(key, {
          result: {
            name: provider.name,
            icon: provider.icon,
            color: provider.color,
            usage: previous?.usage,
            error: hasUsage(previous?.usage)
              ? undefined
              : error instanceof Error
                ? error.message
                : String(error),
          },
          fetchedAt: Date.now(),
          inFlight: false,
        });
      })
      .finally(onUpdate);
  }

  return (
    cache.get(key)?.result ?? {
      name: provider.name,
      icon: provider.icon,
      color: provider.color,
      error: "Loading…",
    }
  );
}

async function collectResults(config: PluginConfig, onUpdate: () => void): Promise<ProviderResult[]> {
  const results: ProviderResult[] = [];

  for (const provider of config.providers) {
    if (provider.type === "file") {
      results.push(await fetchFileUsage(provider));
    } else {
      results.push(readCached(provider, onUpdate));
    }
  }

  return results;
}

async function renderOnce(config: PluginConfig, warning?: string): Promise<void> {
  const results = await Promise.all(config.providers.map(fetchProvider));
  console.log(formatUsageDisplay(results, warning));
}

function main(): void {
  if (process.argv.includes("--config-path")) {
    console.log(getConfigPath() ?? "no config file found");
    return;
  }

  const { config, error } = loadConfig();

  if (process.argv.includes("--once")) {
    void renderOnce(config, error);
    return;
  }

  const refreshMs = config.refresh_seconds * 1000;
  let rendering = false;

  async function display(): Promise<void> {
    if (rendering) {
      return;
    }
    rendering = true;

    try {
      const results = await collectResults(config, () => {
        // Re-render once the pending fetch lands, after this pass finishes.
        setTimeout(() => void display(), 0);
      });
      console.clear();
      console.log(formatUsageDisplay(results, error));
    } finally {
      rendering = false;
    }
  }

  void display();
  setInterval(() => void display(), refreshMs);
}

main();
