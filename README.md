# claude-code-toggle

A tool for switching between Claude Code settings configurations. Quickly switch between different model providers like GLM, Minimax, or any custom setup.

## Install

```bash
npm install -g claude-code-toggle
```

## Usage

```bash
claude-code-toggle
```

Or run directly without installing:

```bash
npx claude-code-toggle   # npm
pnpx claude-code-toggle  # pnpm
bunx claude-code-toggle  # bun
```

### Alias

Add to your `.bashrc` or `.zshrc`:

```bash
alias cct="npx claude-code-toggle"
```

## How it works

The tool looks for settings files in `~/.claude/`:

- `settings.json` - shown as "default"
- `settings.{name}.json` - shown as "{name}"

When you select a configuration, it launches Claude with that settings file:

```bash
claude --settings ~/.claude/settings.{name}.json
```

## Actions

- **Select a config** - launches Claude with that configuration
- **Create new** - creates a new `settings.{name}.json` file
- **Edit** - opens a config in your editor (nano/vim/code/cursor)
- **Delete** - removes a config (default cannot be deleted)
