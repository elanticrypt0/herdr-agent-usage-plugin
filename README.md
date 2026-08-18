# AI Usage Plugin for Herdr

Display AI agent usage directly in Herdr. Claude, Codex and Gemini work out of the box from their
local `usage.json` files, and any other agent — OpenCode included — can be added through a config
file. Session, weekly and monthly percentages plus reset times, at a glance in a split pane.

## Features

- **Built-in agents**: Claude, Codex and Gemini are read automatically from `~/.claude`, `~/.codex`, `~/.gemini`
- **OpenCode support**: fetches live usage from `opencode.ai` with your session cookie (and optionally a workspace ID)
- **Extensible**: add any agent with a `file` provider (local JSON) or a `command` provider (any command that prints usage JSON)
- **Session, Weekly & Monthly Tracking**: percentages with reset times
- **Visual Progress Bars**: 10-character bars reflecting actual percentages
- **Colored Icons**: each agent has its own icon and 256-color code, configurable
- **Smart Polling**: local files are re-read on every refresh, remote providers use their own slower poll interval and keep the last good numbers when a fetch fails
- **Split Pane Display**: always-visible panel in Herdr session
- **Smart Display**: only shows agents with data or with something to report

## Requirements

- Herdr v0.7.0 or later
- Node.js 18+ (global `fetch` is required for the OpenCode provider)
- At least one agent with usage data (a local `usage.json`, or a configured OpenCode/command provider)

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

The plugin works with no configuration at all: Claude, Codex and Gemini are read from their default
paths. To add other agents, create:

```
~/.config/herdr/agent-usage.json
```

(alternatives: `$XDG_CONFIG_HOME/herdr/agent-usage.json`, `~/.herdr/agent-usage.json`, or any path in
`HERDR_AGENT_USAGE_CONFIG`). A sample lives in [`examples/agent-usage.json`](examples/agent-usage.json).

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
| `type` | all | `file`, `command` or `opencode` |
| `name` | all | Display name, also the merge key against built-ins |
| `icon` | all | Any character, e.g. `◆` |
| `color` | all | 256-color index for the icon (e.g. `208` orange) |
| `enabled` | all | `false` removes the provider |

### `file` provider

| Field | Description |
|---|---|
| `path` | Path to a usage JSON file (`~` is expanded) |

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

## How It Works

1. Loads the provider list: built-in Claude/Codex/Gemini file providers merged with your config
2. `file` providers are re-read on every refresh (default every 30s)
3. `command` and `opencode` providers run on their own poll interval and are served from cache in between
4. OpenCode: sends the auth cookie to `opencode.ai`, resolves the workspace (from config or the workspaces
   endpoint), loads `/workspace/<id>/go` and extracts `rollingUsage` / `weeklyUsage` / `monthlyUsage`
5. Percentages and reset times are normalized into session / weekly / monthly windows
6. The pane re-renders on the refresh interval, and again as soon as a background fetch lands
7. A failed remote fetch keeps the last good numbers instead of blanking the pane

## Data Locations

**Built-in file providers:**

| Agent | File | Icon |
|---|---|---|
| Claude | `~/.claude/usage.json` | Orange ✻ |
| Codex | `~/.codex/usage.json` | Purple ֎ |
| Gemini | `~/.gemini/usage.json` | Blue ✦ |

**OpenCode:** no local file — read live from `opencode.ai` (needs cookie + optional workspace ID).

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

- Verify at least one agent directory exists: `~/.claude/`, `~/.codex/`, or `~/.gemini/`
- Check that the corresponding `usage.json` files exist and are valid JSON
- For other agents, confirm the config is being loaded: `node dist/index.js --config-path`

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

- Confirm the path with `node dist/index.js --config-path`
- Invalid JSON is reported as a warning line at the top of the pane
- Providers need a `name` and a supported `type` (`file`, `command`, `opencode`)

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
- The plugin only ever sends the cookie to `https://opencode.ai`, and only issues GET requests.

## License

MIT

## Contributing

Found a bug or have a feature request? Please open an issue or submit a pull request.
