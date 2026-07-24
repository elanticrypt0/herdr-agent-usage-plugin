# AI Usage Plugin for Herdr

Display Claude, Codex, and Gemini API usage directly in Herdr. Keep track of session and weekly usage percentages and reset times at a glance in a split pane.

## Features

- **Multi-AI Support**: Display Claude, Codex, and Gemini usage simultaneously
- **Session & Weekly Tracking**: Shows both session and weekly usage percentages with reset times
- **Visual Progress Bars**: Accurate 10-character progress bars reflecting actual percentages
- **Colored Icons**: Each AI tool has a distinct colored icon for quick identification
  - 𖠌 Claude: Orange ✻
  - Codex: Purple ֎
  - Gemini: Blue ✦
- **Split Pane Display**: Always-visible panel in Herdr session for quick reference
- **Auto-Refresh**: Updates every 30 seconds automatically
- **Smart Display**: Only shows available AI tools, hides unavailable ones
- **Fallback Messages**: Clear messaging when usage data is unavailable

## Requirements

- Herdr v0.7.0 or later
- Node.js 18+ (for running the plugin)
- At least one of: `~/.claude/usage.json`, `~/.codex/usage.json`, or `~/.gemini/usage.json`

## Installation

### Link Plugin (Local Development)

```bash
herdr plugin link /path/to/herdr-claude-usage-plugin
```

Then open the pane:

```bash
herdr plugin pane open --plugin claude-usage --entrypoint claude_usage
```

### Install from GitHub (Once Published)

```bash
herdr plugin install username/herdr-claude-usage-plugin
```

## Usage

### Opening the Usage Display

Once installed, open the AI usage pane from Herdr:

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

### Output Format

**With all three AI tools:**
```
𖠌 Your AI usage
✻ Claude usage
Session: ██████░░░░ 58% 4h    Weekly: ████░░░░░░ 41% 6d

֎ Codex usage
Session: ███████░░░ 72% 4h    Weekly: ████░░░░░░ 35% 6d

✦ Gemini usage
Session: ██░░░░░░░░ 23% 2d    Weekly: ██░░░░░░░░ 18% 6d
```

**Format breakdown:**
- **𖠌**: Header icon (white)
- **✻ / ֎ / ✦**: AI tool icons with colors
- **Progress bars**: 10-character bars showing actual usage percentage
- **Percentage**: Usage as percentage of limit
- **Time**: Time until reset (h = hours, d = days, wk = week)

**When usage data unavailable:**
```
No usage for Claude, Codex or Gemini detected
```

**When only some tools available:**
Only displays tools with available data; others are automatically hidden.

## How It Works

The plugin:

1. Reads usage data from multiple AI tool directories (`~/.claude`, `~/.codex`, `~/.gemini`)
2. Parses `usage.json` files from each tool directory
3. Extracts session and weekly usage percentages and reset timestamps
4. Calculates time remaining until usage resets
5. Renders formatted display with colored icons and progress bars
6. Auto-refreshes every 30 seconds in split pane
7. Only displays available AI tools with data

## Data Locations

The plugin reads usage data from three locations:

**Claude:**
- File: `~/.claude/usage.json`
- Icon: Orange ✻

**Codex:**
- File: `~/.codex/usage.json`
- Icon: Purple ֎

**Gemini:**
- File: `~/.gemini/usage.json`
- Icon: Blue ✦

### File Format

Each usage file should have this structure:
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

- `usage_percentage`: Number between 0-100
- `reset_timestamp`: Unix timestamp in milliseconds when usage resets

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

### Plugin shows "No usage for Claude, Codex or Gemini detected"

- Verify at least one AI tool directory exists: `~/.claude/`, `~/.codex/`, or `~/.gemini/`
- Check that corresponding `usage.json` files exist and are valid JSON
- Ensure you have active subscriptions for the AI tools you want to track

### Pane won't open

- Verify Herdr version is 0.7.0 or later: `herdr --version`
- Ensure plugin is linked: `herdr plugin list`
- Check plugin was built successfully: `npm run build`
- Verify plugin ID is correct: `claude-usage`

### Usage data not refreshing

- Plugin auto-refreshes every 30 seconds
- Usage data is cached from AI services
- Restart the corresponding AI CLI tool to refresh data
- Check that usage.json files are being updated by the AI tools

### Only some AI tools showing

- This is normal behavior - only tools with available usage data are displayed
- Ensure usage.json exists in the tool's directory
- Check file format matches expected structure

## License

MIT

## Contributing

Found a bug or have a feature request? Please open an issue or submit a pull request.
