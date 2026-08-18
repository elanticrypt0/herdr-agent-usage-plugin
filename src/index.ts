import { fetchProvider, readCachedProvider } from "./cache";
import { getConfigPath, loadConfig } from "./config";
import { formatUsageDisplay } from "./render";
import { runSidebar } from "./sidebar";
import { PluginConfig, ProviderResult } from "./types";

async function collectResults(config: PluginConfig, onUpdate: () => void): Promise<ProviderResult[]> {
  const results: ProviderResult[] = [];

  for (const provider of config.providers) {
    if (provider.type === "file") {
      results.push(await fetchProvider(provider));
    } else {
      results.push(readCachedProvider(provider, onUpdate));
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

  if (process.argv.includes("--sidebar")) {
    void runSidebar(config);
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
