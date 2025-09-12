# Reboarder

A kanban-style board view for organizing notes by folder with snooze and unpin functionality.

## Local Development

### Quick Setup

1. **Set your Obsidian vault path**:
   ```bash
   export OBSIDIAN_VAULT_PATH="/path/to/your/obsidian/vault"
   ```

2. **Install and watch for changes**:
   ```bash
   npm run watch-install
   ```

This will build your plugin and automatically copy it to your Obsidian vault whenever you make changes!

### Available Commands

- `npm run dev` - Start esbuild in watch mode (build only)
- `npm run build` - Build for production
- `npm run install-local` - Copy built files to Obsidian vault
- `npm run dev-install` - Build and install to vault (one-time)
- `npm run watch-install` - Watch for changes and auto-install (**recommended for development**)

### First Time Setup

1. Build the plugin:
   ```bash
   npm run build
   ```

2. Set your vault path and install:
   ```bash
   OBSIDIAN_VAULT_PATH="/path/to/your/vault" npm run install-local
   ```

3. Enable the plugin in Obsidian:
   - Open Obsidian Settings
   - Go to Community Plugins
   - Find "Reboarder" and toggle it on

### Development Workflow

For the best development experience:

```bash
# Set vault path (do this once in your shell profile)
export OBSIDIAN_VAULT_PATH="/Users/yourname/Documents/YourVault"

# Start watch mode - this will rebuild and install automatically on file changes
npm run watch-install
```

Now whenever you save changes to your TypeScript files, the plugin will automatically rebuild and be copied to your Obsidian vault!

## Installation via BRAT

### Using BRAT (Beta Reviewer's Auto-update Tool)
1. Install the BRAT plugin from the Obsidian Community Plugins
2. In BRAT settings, click "Add Beta Plugin"
3. Enter: `MartinBernstorff/Reboarder`
4. Click "Add Plugin"
5. Enable "Reboarder" in Community Plugins settings
