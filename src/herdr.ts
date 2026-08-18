import { execFile } from "child_process";

const HERDR_BIN = process.env.HERDR_BIN || "herdr";
const CALL_TIMEOUT_MS = 10000;

export interface PaneInfo {
  pane_id: string;
  workspace_id?: string;
  agent?: string;
}

function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(HERDR_BIN, args, { timeout: CALL_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * The CLI answers with one JSON envelope per line: { result } or { error }.
 * Mutating commands such as report-metadata succeed silently with no output.
 */
async function call(args: string[]): Promise<any> {
  const stdout = await run(args);
  const line = stdout.trim().split("\n").pop() ?? "";

  if (!line) {
    return null;
  }

  const payload = JSON.parse(line);

  if (payload.error) {
    throw new Error(payload.error.message || payload.error.code || "herdr error");
  }
  return payload.result;
}

export async function listPanes(): Promise<PaneInfo[]> {
  const result = await call(["pane", "list"]);
  return Array.isArray(result?.panes) ? result.panes : [];
}

export function setPaneToken(
  paneId: string,
  source: string,
  token: string,
  value: string,
  ttlMs: number
): Promise<any> {
  return call([
    "pane",
    "report-metadata",
    paneId,
    "--source",
    source,
    "--token",
    `${token}=${value}`,
    "--ttl-ms",
    String(ttlMs),
  ]);
}

export function clearPaneToken(paneId: string, source: string, token: string): Promise<any> {
  return call(["pane", "report-metadata", paneId, "--source", source, "--clear-token", token]);
}

export function setWorkspaceToken(
  workspaceId: string,
  source: string,
  token: string,
  value: string,
  ttlMs: number
): Promise<any> {
  return call([
    "workspace",
    "report-metadata",
    workspaceId,
    "--source",
    source,
    "--token",
    `${token}=${value}`,
    "--ttl-ms",
    String(ttlMs),
  ]);
}

export function clearWorkspaceToken(workspaceId: string, source: string, token: string): Promise<any> {
  return call(["workspace", "report-metadata", workspaceId, "--source", source, "--clear-token", token]);
}
