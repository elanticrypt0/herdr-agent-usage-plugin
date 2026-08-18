# AI Usage Plugin for Herdr

Display AI agent usage directly in Herdr. Claude, Codex and OpenCode report live usage from the
account you are already signed into, Gemini is read from a local `usage.json`, and any other agent
can be added through a config file. Session, weekly and monthly percentages plus reset times, at a
glance in a split pane or in the sidebar.

**Contents:** [Quick start](#quick-start) · [Configuration reference](#configuration) ·
[Sidebar mode](#sidebar-mode) · [Troubleshooting](#troubleshooting)

## Features

- **Built-in agents**: Claude and Codex use the credentials their CLIs already store, Gemini is read from `~/.gemini/usage.json`
- **Claude**: `api.anthropic.com/api/oauth/usage` with the OAuth token in `~/.claude/.credentials.json` — nothing to configure
- **Codex**: `chatgpt.com/backend-api/wham/usage` with the tokens in `~/.codex/auth.json` — nothing to configure
- **OpenCode**: fetches live usage from `opencode.ai` with your session cookie (and optionally a workspace ID)
- **Extensible**: add any agent with a `file` provider (local JSON) or a `command` provider (any command that prints usage JSON)
- **Session, Weekly & Monthly Tracking**: percentages with reset times
- **Visual Progress Bars**: 10-character bars reflecting actual percentages
- **Colored Icons**: each agent has its own icon and 256-color code, configurable
- **Smart Polling**: local files are re-read on every refresh, remote providers use their own slower poll interval and keep the last good numbers when a fetch fails
- **Sidebar Mode**: pushes a compact `$usage` token into Herdr's sidebar rows, under each agent
- **Split Pane Display**: always-visible panel in Herdr session
- **Smart Display**: only shows agents with data or with something to report

## Requirements

- Herdr v0.7.0 or later
- Node.js 18+ (global `fetch` is required by the Claude, Codex and OpenCode providers)
- At least one agent to report on: a signed-in Claude Code or Codex CLI, an OpenCode session cookie,
  a local `usage.json`, or a `command` provider

## Installation

### Link Plugin (Local Development)

```bash
herdr plugin link /path/to/herdr-agent-usage-plugin
```

Then open the pane:

```bash
herdr plugin pane open --plugin claude-usage --entrypoint claude_usage
```

### Install from GitHub (Once Published)

```bash
herdr plugin install username/herdr-agent-usage-plugin
```

## Quick start

### 1. Check what already works

Claude, Codex and Gemini need **no configuration**. Link the plugin, open the pane, and see what
reports:

```bash
herdr plugin link /path/to/herdr-agent-usage-plugin
node dist/index.js --once
```

```
𖠌 Your AI usage
✻ Claude usage
Session: ███░░░░░░░ 28% 3h    Weekly: ██░░░░░░░░ 22% 1d

֎ Codex usage
Weekly: ███░░░░░░░ 31% 2d
```

An agent that needs something shows the reason instead of numbers, e.g.
`⚠ Not signed in — no OAuth credentials in ~/.claude`.

### 2. Create the config file (only if you want more)

Everything else — OpenCode, extra agents, the sidebar, icons, intervals — lives in **one JSON file**:

```bash
mkdir -p ~/.config/herdr
$EDITOR ~/.config/herdr/agents-usage.json
```

Minimum viable file, which changes nothing yet:

```json
{
  "providers": []
}
```

Check the plugin is reading it:

```bash
node dist/index.js --config-path
# /home/you/.config/herdr/agents-usage.json
```

Every provider you add to `providers` is merged **on top of** the built-in agents by `name`, so the
file only has to contain what you want to add or change. There is a ready-to-copy sample in
[`examples/agents-usage.json`](examples/agents-usage.json).

### 3. Add OpenCode

OpenCode has no local usage file, so it needs your `opencode.ai` session cookie:

```bash
# 1. Log in at https://opencode.ai in your browser
# 2. DevTools → Application → Cookies → copy the value of the `auth` cookie
printf '%s' 'auth=Fe26.2**…' > ~/.config/herdr/opencode-cookie.txt
chmod 600 ~/.config/herdr/opencode-cookie.txt
```

Then add the provider:

```json
{
  "providers": [
    {
      "type": "opencode",
      "name": "OpenCode",
      "icon": "◆",
      "color": 250,
      "cookie_file": "~/.config/herdr/opencode-cookie.txt",
      "workspace_id": "wrk_xxxxxxxxxxxx"
    }
  ]
}
```

`workspace_id` is optional — it is the `wrk_…` segment of
`https://opencode.ai/workspace/wrk_xxxxxxxxxxxx/go`, and the plugin discovers it on its own when
omitted. Verify with `node dist/index.js --once`.

### 4. Add any other agent

Point a `command` provider at anything that prints usage as JSON on stdout:

```json
{
  "providers": [
    {
      "type": "command",
      "name": "My Agent",
      "icon": "◇",
      "color": 45,
      "command": "my-agent usage --json",
      "poll_seconds": 300
    }
  ]
}
```

The command only has to print percentages and, ideally, when they reset:

```json
{
  "session": { "usage_percentage": 58, "reset_in_sec": 7200 },
  "weekly":  { "usage_percentage": 41, "reset_in_sec": 432000 }
}
```

Field names are matched leniently — see [Usage file format](#usage-file-format). If the agent writes
a usage file instead of having a CLI, use a `file` provider with its `path`.

### 5. Tweak or disable a built-in

Same file, same `name` as the built-in:

```json
{
  "refresh_seconds": 30,
  "providers": [
    { "type": "claude", "name": "Claude", "icon": "★", "color": 214, "poll_seconds": 600 },
    { "type": "file", "name": "Gemini", "enabled": false, "path": "~/.gemini/usage.json" }
  ]
}
```

### 6. Show it in the sidebar

Two steps, both needed — see [Sidebar mode](#sidebar-mode) for the details:

```jsonc
// ~/.config/herdr/agents-usage.json — optional, these are the defaults
{ "sidebar": { "enabled": true, "interval_seconds": 60, "token": "usage", "format": "compact" } }
```

```toml
# ~/.config/herdr/config.toml — this part is required
[ui.sidebar.agents]
rows = [
  ["state_icon", "workspace", "tab"],
  ["agent"],
  [{ token = "$usage", dim = true }],
]
```

```bash
herdr server reload-config
```

Each agent row then carries its own usage line:

```
● piba10com  t3
  claude
  S 28% W 22%
```

## Usage

### Opening the Usage Display

```bash
herdr plugin pane open --plugin claude-usage --entrypoint claude_usage
```

Or bind a keybinding in your `~/.config/herdr/config.toml`:

```toml
[[keys.command]]
key = "prefix+u"
type = "plugin_pane"
plugin = "claude-usage"
entrypoint = "claude_usage"
description = "Show AI usage"
```

### Debugging from the terminal

```bash
node dist/index.js --once         # render once and exit (no screen clearing)
node dist/index.js --config-path  # print the config file being used
node dist/index.js --sidebar      # run the sidebar token updater in the foreground
```

### Output Format

```
𖠌 Your AI usage
✻ Claude usage
Session: ██████░░░░ 58% 4h    Weekly: ████░░░░░░ 41% 6d

֎ Codex usage
Session: ███████░░░ 72% 4h    Weekly: ████░░░░░░ 35% 6d

✦ Gemini usage
Session: ██░░░░░░░░ 23% 2d    Weekly: ██░░░░░░░░ 18% 6d

◆ OpenCode usage
Session: ████░░░░░░ 37% 2h    Weekly: ██████░░░░ 64% 5d    Monthly: █░░░░░░░░░ 13% 14d
```

**Format breakdown:**
- **𖠌**: Header icon (white)
- **✻ / ֎ / ✦ / ◆**: agent icons with colors
- **Progress bars**: 10-character bars showing actual usage percentage
- **Percentage**: usage as percentage of limit
- **Time**: time until reset (m = minutes, h = hours, d = days)

When an agent is configured but cannot report, its line shows the reason instead:

```
◆ OpenCode usage
⚠ Session cookie not configured
```

## Configuration

Reference for every option. For step-by-step setup, see [Quick start](#quick-start).

The plugin works with no configuration at all: Claude, Codex and Gemini are read from their default
locations. Everything else goes in:

```
~/.config/herdr/agents-usage.json
```

If `$HERDR_AGENT_USAGE_CONFIG` is set, that path is the config — nothing else is looked at.
Otherwise the first of these that exists wins:

1. `$XDG_CONFIG_HOME/herdr/agents-usage.json` (i.e. `~/.config/herdr/agents-usage.json`)
2. `~/.config/herdr/agent-usage.json` (singular, older name)
3. `~/.herdr/agents-usage.json`, then `~/.herdr/agent-usage.json`

A ready-to-copy sample lives in [`examples/agents-usage.json`](examples/agents-usage.json).

```json
{
  "refresh_seconds": 30,
  "providers": [
    {
      "type": "opencode",
      "name": "OpenCode",
      "icon": "◆",
      "color": 250,
      "cookie_file": "~/.config/herdr/opencode-cookie.txt",
      "workspace_id": "wrk_xxxxxxxxxxxx",
      "poll_seconds": 900
    }
  ]
}
```

Entries are merged **on top of** the built-in agents by `name`, so you can also re-point, re-color or
disable a built-in:

```json
{ "type": "file", "name": "Gemini", "enabled": false, "path": "~/.gemini/usage.json" }
```

### Common fields

| Field | Applies to | Description |
|---|---|---|
| `type` | all | `file`, `command`, `claude`, `codex` or `opencode` |
| `name` | all | Display name, also the merge key against built-ins |
| `icon` | all | Any character, e.g. `◆` |
| `color` | all | 256-color index for the icon (e.g. `208` orange) |
| `enabled` | all | `false` removes the provider |

### `file` provider

| Field | Description |
|---|---|
| `path` | Path to a usage JSON file (`~` is expanded) |

### `claude` provider

Reads the OAuth token Claude Code stores in `~/.claude/.credentials.json` and asks
`https://api.anthropic.com/api/oauth/usage` for the `five_hour` (session) and `seven_day` (weekly)
windows. No configuration needed when Claude Code is signed in.

| Field | Description |
|---|---|
| `config_dir` | Claude config directory (default `$CLAUDE_CONFIG_DIR` or `~/.claude`) |
| `poll_seconds` | Poll interval (default `300`, minimum `30`) |
| `timeout_ms` | Request timeout (default `15000`) |

If there are no credentials it falls back to `<config_dir>/usage.json`, so an externally written
file still works.

### `codex` provider

Reads the tokens Codex stores in `~/.codex/auth.json` and asks
`https://chatgpt.com/backend-api/wham/usage` for the rate-limit windows, classifying them into
session (5h) and weekly (7d) by their declared duration. Plans with a single window only show that
one.

| Field | Description |
|---|---|
| `codex_home` | Codex home directory (default `$CODEX_HOME` or `~/.codex`) |
| `poll_seconds` | Poll interval (default `300`, minimum `30`) |
| `timeout_ms` | Request timeout (default `15000`) |

Same `usage.json` fallback as the Claude provider.

### `command` provider

Runs a command and parses its stdout as usage JSON — the escape hatch for any agent with a CLI.

| Field | Description |
|---|---|
| `command` | Command to run (executed through the shell unless `args` is given) |
| `args` | Optional argument array (skips the shell) |
| `poll_seconds` | How often to run it (default `300`, minimum `5`) |
| `timeout_ms` | Command timeout (default `15000`) |

### `opencode` provider

Fetches usage from `https://opencode.ai` using your browser session.

| Field | Description |
|---|---|
| `cookie` | Session cookie: the bare value, `auth=…`, or the full `Cookie` header |
| `cookie_file` | Path to a file containing the cookie (preferred — keeps it out of the config) |
| `cookie_env` | Name of an environment variable holding the cookie |
| `workspace_id` | Workspace ID (`wrk_…` or `wk_…`). Optional: auto-discovered when omitted |
| `poll_seconds` | Poll interval (default `900`, minimum `30`) |
| `timeout_ms` | Request timeout (default `15000`) |

Cookie sources are tried in order: `cookie_file`, `cookie_env`, `cookie`.

You can also skip the config file entirely and export:

```bash
export HERDR_OPENCODE_COOKIE='auth=Fe26.2**…'
export HERDR_OPENCODE_WORKSPACE_ID='wrk_xxxxxxxxxxxx'   # optional
```

#### Getting the session cookie and workspace ID

1. Log in at <https://opencode.ai> in your browser.
2. Open DevTools → **Network**, click any request to `opencode.ai`, and copy the **Cookie** request
   header (or just the `auth` cookie value from **Application → Cookies**).
3. Store it somewhere the config points at, and keep the file private:

   ```bash
   printf '%s' 'auth=Fe26.2**…' > ~/.config/herdr/opencode-cookie.txt
   chmod 600 ~/.config/herdr/opencode-cookie.txt
   ```

4. The **workspace ID** is the `wrk_…` segment in the URL of your workspace page
   (`https://opencode.ai/workspace/wrk_xxxxxxxxxxxx/go`). It is optional — the plugin asks
   opencode.ai for your workspaces when it is not set — but setting it saves a request and avoids
   ambiguity when you belong to several workspaces.

The cookie expires like any browser session; when it does, the pane shows
`Session cookie rejected — copy a fresh one from opencode.ai` and you repeat the steps above.

### Full example

Everything the plugin understands, in one file:

```json
{
  "refresh_seconds": 30,
  "providers": [
    { "type": "claude", "name": "Claude", "icon": "✻", "color": 208, "poll_seconds": 300 },
    { "type": "codex", "name": "Codex", "icon": "֎", "color": 135, "poll_seconds": 300 },
    { "type": "file", "name": "Gemini", "icon": "✦", "color": 63, "path": "~/.gemini/usage.json" },
    {
      "type": "opencode",
      "name": "OpenCode",
      "icon": "◆",
      "color": 250,
      "cookie_file": "~/.config/herdr/opencode-cookie.txt",
      "workspace_id": "wrk_xxxxxxxxxxxx",
      "poll_seconds": 900
    },
    {
      "type": "command",
      "name": "My Agent",
      "icon": "◇",
      "color": 45,
      "agent": ["my-agent"],
      "command": "my-agent usage --json",
      "poll_seconds": 300
    }
  ],
  "sidebar": {
    "enabled": true,
    "interval_seconds": 60,
    "token": "usage",
    "format": "compact",
    "primary": "session",
    "bar_width": 5,
    "show_reset": false,
    "workspace_token": null
  }
}
```

## Sidebar mode

Besides the split pane, the plugin can push usage **into Herdr's sidebar**, as an extra row under
each agent entry. Herdr has no plugin-owned sidebar section — plugin panes only support
`overlay`, `popup`, `split`, `tab` and `zoomed` — but sidebar rows can render custom `$name` tokens
fed through pane and workspace metadata, and that is what this mode uses.

Requires Herdr 0.8.0+ (metadata tokens). Two pieces are needed:

**1. The plugin side** runs automatically: the manifest declares a `[[startup]]` command
(`node dist/index.js --sidebar`) that polls the providers and reports one token per agent pane.
It matches a pane's agent to a provider by name, so `Claude` → `claude` panes and `OpenCode` →
`opencode` panes. Use `agent` on a provider when the ids differ:

```json
{ "type": "command", "name": "My Agent", "agent": ["cline", "cursor"], "command": "…" }
```

**2. Your `~/.config/herdr/config.toml`** has to reference the token in the sidebar rows:

```toml
[ui.sidebar.agents]
rows = [["state_icon", "workspace", "tab"], ["agent", "$usage"]]
```

Or give it its own line under the agent, optionally styled:

```toml
[ui.sidebar.agents]
rows = [["state_icon", "workspace", "tab"], ["agent"], [{ token = "$usage", fg = "#89b4fa", dim = true }]]
```

Apply it with `herdr server reload-config`.

### Sidebar options

```json
{
  "sidebar": {
    "enabled": true,
    "interval_seconds": 60,
    "token": "usage",
    "format": "compact",
    "primary": "session",
    "bar_width": 5,
    "show_reset": false,
    "workspace_token": null
  }
}
```

| Field | Description |
|---|---|
| `enabled` | `false` makes the startup process exit immediately |
| `interval_seconds` | How often tokens are refreshed (default `60`, minimum `5`). Remote providers still honour their own `poll_seconds` |
| `token` | Token name, referenced as `$usage` in `config.toml` |
| `format` | `compact` → `S 58% W 41% M 92%`, `bar` → `████░ 92%`, `percent` → `58%/41%/92%` |
| `primary` | Window the `bar` format and the workspace summary highlight: `session` (default), `weekly`, `monthly`, or `max` (the fullest one) |
| `bar_width` | Bar length for `format: "bar"` (default `5`) |
| `show_reset` | Append the reset time of the first window (e.g. `4h`) |
| `workspace_token` | When set (e.g. `"agents_usage"`), also pushes a one-line summary of all providers as a **workspace** token, for `[ui.sidebar.spaces]` rows |

Tokens are display-only, carry a TTL of three intervals, and are cleared when the process stops, so
nothing is left behind if the plugin is disabled.

To use the summary in the spaces section:

```toml
[ui.sidebar.spaces]
rows = [["state_icon", "workspace"], ["branch", "$agents_usage"]]
```

Run it by hand to debug: `node dist/index.js --sidebar` (log lines go to stderr, and
`herdr plugin log` shows the startup process output).

## How It Works

1. Loads the provider list: the built-in Claude/Codex/Gemini providers merged with your config
2. `file` providers are re-read on every refresh (default every 30s)
3. `claude`, `codex`, `command` and `opencode` providers run on their own poll interval and are served from cache in between
4. OpenCode: sends the auth cookie to `opencode.ai`, resolves the workspace (from config or the workspaces
   endpoint), loads `/workspace/<id>/go` and extracts `rollingUsage` / `weeklyUsage` / `monthlyUsage`
5. Percentages and reset times are normalized into session / weekly / monthly windows
6. The pane re-renders on the refresh interval, and again as soon as a background fetch lands
7. A failed remote fetch keeps the last good numbers instead of blanking the pane

## Data Locations

| Agent | Source | Icon |
|---|---|---|
| Claude | `~/.claude/.credentials.json` → Anthropic usage API (falls back to `~/.claude/usage.json`) | Orange ✻ |
| Codex | `~/.codex/auth.json` → ChatGPT usage API (falls back to `~/.codex/usage.json`) | Purple ֎ |
| Gemini | `~/.gemini/usage.json` | Blue ✦ |
| OpenCode | `opencode.ai` with your session cookie (+ optional workspace ID) | Grey ◆ |

### Usage file format

```json
{
  "session": {
    "usage_percentage": 58,
    "reset_timestamp": 1234567890000
  },
  "weekly": {
    "usage_percentage": 41,
    "reset_timestamp": 1234567890000
  }
}
```

- `usage_percentage`: number between 0-100
- `reset_timestamp`: Unix timestamp in milliseconds when usage resets

The parser is tolerant, which is what makes `command` providers easy to write. It also accepts:

- window keys `rolling` / `rollingUsage` (as session), `weeklyUsage`, `monthly` / `monthlyUsage`
- percentage keys `usagePercent`, `used_percent`, `usedPercent`, `percent`
- reset keys `resetsAt`, `reset_at` (seconds or milliseconds), `resetInSec`, `reset_in_sec`

## Building from Source

```bash
npm install
npm run build
```

Built files go to `dist/`.

## Platform Support

- **macOS**: ✓ Fully supported
- **Linux**: ✓ Fully supported
- **Windows**: Not yet supported

## Troubleshooting

### Plugin shows "No agent usage detected"

- Claude: sign in with Claude Code so `~/.claude/.credentials.json` exists
- Codex: sign in with `codex login` so `~/.codex/auth.json` has `tokens.access_token`
- Gemini: check that `~/.gemini/usage.json` exists and is valid JSON
- For other agents, confirm the config is being loaded: `node dist/index.js --config-path`

### Claude or Codex line shows an error

| Message | Fix |
|---|---|
| `Not signed in …` | The CLI has no stored credentials — sign in with Claude Code or `codex login` |
| `Credentials expired …` | Run the CLI once so it refreshes its token; the plugin never refreshes tokens itself |
| `Usage fetch failed (4xx/5xx)` | The account API rejected the request; retry, and check the CLI still works |

### OpenCode line shows an error

| Message | Fix |
|---|---|
| `Session cookie not configured` | Set `cookie`, `cookie_file` or `cookie_env` (or `HERDR_OPENCODE_COOKIE`) |
| `No auth cookie found …` | The pasted value has no `auth` / `__Host-auth` cookie — copy the full Cookie header |
| `Session cookie rejected …` | The session expired; copy a fresh cookie |
| `Invalid workspace ID …` | It must match `wrk_…` or `wk_…` |
| `No workspace found …` | Set `workspace_id` explicitly |
| `Could not parse usage data from page` | opencode.ai changed its page layout — open an issue |

Run `node dist/index.js --once` to see the raw result without the pane refreshing over it.

### Config file ignored

- Confirm the path with `node dist/index.js --config-path` (it looks for `agents-usage.json` first, then `agent-usage.json`)
- Invalid JSON is reported as a warning line at the top of the pane
- Providers need a `name` and a supported `type` (`file`, `command`, `claude`, `codex`, `opencode`)

### Sidebar shows nothing

- The row token must be referenced in `config.toml` (`"$usage"`) and applied with `herdr server reload-config`
- The token only appears on panes whose agent matches a provider — check `herdr pane list` for the `agent` field and map it with the provider's `agent` option
- A provider with no data reports no token; confirm with `node dist/index.js --once`
- Check the updater's output with `herdr plugin log`

### Pane won't open

- Verify Herdr version is 0.7.0 or later: `herdr --version`
- Ensure plugin is linked: `herdr plugin list`
- Check plugin was built successfully: `npm run build`
- Verify plugin ID is correct: `claude-usage`

### Usage data not refreshing

- Local files refresh every `refresh_seconds` (default 30)
- Remote providers refresh on `poll_seconds` (OpenCode default 900 = 15 min)
- Restart the corresponding AI CLI tool if it is not updating its own `usage.json`

## Security Notes

- The OpenCode session cookie grants access to your opencode.ai account. Prefer `cookie_file` with
  `chmod 600`, or `cookie_env`, over inlining it in the config file.
- Credentials are only ever sent to their own service — the cookie to `https://opencode.ai`, the
  Claude token to `https://api.anthropic.com`, the Codex tokens to `https://chatgpt.com` — and every
  request is a GET.
- The plugin reads credential files but never writes or refreshes them.

## License

MIT

## Contributing

Found a bug or have a feature request? Please open an issue or submit a pull request.
