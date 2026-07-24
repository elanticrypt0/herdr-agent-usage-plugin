# Claude Usage Plugin for Herdr

Display your Claude API usage directly in Herdr. Keep track of session and weekly usage percentages and reset times at a glance.

## Features

- **Session Usage**: Shows current session usage percentage and time until reset
- **Weekly Usage**: Displays weekly usage percentage and time until reset  
- **Visual Indicators**: Progress bars for quick visual reference
- **Split Pane Display**: Displays at the bottom of your Herdr session for always-on visibility
- **Fallback Message**: Shows "No Claude usage detected" when subscription data is unavailable

## Requirements

- Herdr v0.7.0 or later
- Node.js 18+ (for running the plugin)
- Claude repository at `~/.claude` with `usage.json` file

## Installation

### Link Plugin (Local Development)

```bash
herdr plugin link /path/to/herdr-claude-usage-plugin
```

Then open the pane:

```bash
herdr plugin pane open --plugin "Claude Usage" --entrypoint claude_usage
```

### Install from GitHub (Once Published)

```bash
herdr plugin install username/herdr-claude-usage-plugin
```

## Usage

### Opening the Usage Display

Once installed, open the Claude usage pane from Herdr:

```bash
herdr plugin pane open --plugin "Claude Usage" --entrypoint claude_usage
```

Or bind a keybinding in your `~/.config/herdr/config.toml`:

```toml
[[keys.command]]
key = "prefix+u"
type = "plugin_pane"
plugin = "Claude Usage"
entrypoint = "claude_usage"
description = "Show Claude usage"
```

### Output Format

```
✨ █░░ 58% 5h · █░░ 41% wk
```

- **✨**: Claude icon
- **Progress bar**: Visual usage indicator
- **Percentage**: Usage as percentage of limit
- **Time**: Time until reset (h = hours, wk = week, d = days, m = minutes)

If Claude usage data is not available:

```
No Claude usage detected
```

## How It Works

The plugin:

1. Reads Claude subscription and usage data from `~/.claude/usage.json`
2. Extracts session and weekly usage percentages and reset timestamps
3. Calculates time remaining until usage resets
4. Renders a formatted display with progress bars and times
5. Displays as a split pane at the bottom of your Herdr session

## Data Location

Claude stores usage data at: `~/.claude/usage.json`

The plugin looks for this structure:
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

### Plugin shows "No Claude usage detected"

- Verify Claude repository exists at `~/.claude/`
- Check that `~/.claude/usage.json` file exists and is valid JSON
- Ensure you have an active Claude subscription

### Pane won't open

- Verify Herdr version is 0.7.0 or later: `herdr --version`
- Ensure plugin is linked: `herdr plugin list`
- Check plugin was built successfully: `npm run build`

### Wrong usage numbers

- Usage data in `~/.claude/usage.json` is cached from Claude services
- Restart Claude Code or wait for the cache to refresh
- Plugin displays data as provided by Claude

## License

MIT

## Contributing

Found a bug or have a feature request? Please open an issue or submit a pull request.
