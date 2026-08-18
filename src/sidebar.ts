import { getProviderResult } from "./cache";
import { clearPaneToken, clearWorkspaceToken, listPanes, setPaneToken, setWorkspaceToken } from "./herdr";
import { formatSidebarSummary, formatSidebarToken } from "./render";
import { PluginConfig, ProviderConfig, ProviderResult } from "./types";
import { hasUsage } from "./usage";

const METADATA_SOURCE = "herdr-agent-usage";
const MAX_TTL_MS = 86400000;

function normalizeAgentId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** A provider matches a herdr agent by its `agent` aliases, falling back to its name. */
function agentAliases(provider: ProviderConfig): string[] {
  const explicit = provider.agent
    ? Array.isArray(provider.agent)
      ? provider.agent
      : [provider.agent]
    : [];
  return [...explicit, provider.name].map(normalizeAgentId).filter(Boolean);
}

export async function runSidebar(config: PluginConfig): Promise<void> {
  const { sidebar } = config;

  if (!sidebar.enabled) {
    return;
  }

  const intervalMs = sidebar.interval_seconds * 1000;
  const ttlMs = Math.min(MAX_TTL_MS, Math.max(1, intervalMs * 3));
  const taggedPanes = new Set<string>();
  const taggedWorkspaces = new Set<string>();
  let stopping = false;

  async function tick(): Promise<void> {
    const results = await Promise.all(config.providers.map(getProviderResult));

    const byAgent = new Map<string, ProviderResult>();
    config.providers.forEach((provider, index) => {
      const result = results[index];
      if (!hasUsage(result.usage)) {
        return;
      }
      for (const alias of agentAliases(provider)) {
        byAgent.set(alias, result);
      }
    });

    const panes = await listPanes();
    const workspaces = new Set<string>();

    for (const pane of panes) {
      if (pane.workspace_id) {
        workspaces.add(pane.workspace_id);
      }
      if (!pane.agent) {
        continue;
      }

      const result = byAgent.get(normalizeAgentId(pane.agent));
      const value = result?.usage ? formatSidebarToken(result.usage, sidebar) : null;

      // A pane can close between listing and reporting; never let one pane
      // abort the pass for the others.
      try {
        if (value) {
          await setPaneToken(pane.pane_id, METADATA_SOURCE, sidebar.token, value, ttlMs);
          taggedPanes.add(pane.pane_id);
        } else if (taggedPanes.has(pane.pane_id)) {
          await clearPaneToken(pane.pane_id, METADATA_SOURCE, sidebar.token);
          taggedPanes.delete(pane.pane_id);
        }
      } catch (error) {
        console.error(
          `[agent-usage] could not update ${pane.pane_id}: ${error instanceof Error ? error.message : error}`
        );
      }
    }

    if (sidebar.workspace_token) {
      const summary = formatSidebarSummary(results, sidebar);
      for (const workspaceId of workspaces) {
        if (summary) {
          await setWorkspaceToken(workspaceId, METADATA_SOURCE, sidebar.workspace_token, summary, ttlMs);
          taggedWorkspaces.add(workspaceId);
        } else if (taggedWorkspaces.has(workspaceId)) {
          await clearWorkspaceToken(workspaceId, METADATA_SOURCE, sidebar.workspace_token);
          taggedWorkspaces.delete(workspaceId);
        }
      }
    }
  }

  async function cleanup(): Promise<void> {
    if (stopping) {
      return;
    }
    stopping = true;

    for (const paneId of taggedPanes) {
      await clearPaneToken(paneId, METADATA_SOURCE, sidebar.token).catch(() => undefined);
    }
    for (const workspaceId of taggedWorkspaces) {
      await clearWorkspaceToken(workspaceId, METADATA_SOURCE, sidebar.workspace_token!).catch(
        () => undefined
      );
    }
    process.exit(0);
  }

  process.on("SIGINT", () => void cleanup());
  process.on("SIGTERM", () => void cleanup());

  async function loop(): Promise<void> {
    try {
      await tick();
    } catch (error) {
      // Keep the loop alive: herdr may still be starting, or a pane may have
      // closed between listing and reporting.
      console.error(`[agent-usage] sidebar update failed: ${error instanceof Error ? error.message : error}`);
    }
    if (!stopping) {
      setTimeout(() => void loop(), intervalMs);
    }
  }

  await loop();
}
