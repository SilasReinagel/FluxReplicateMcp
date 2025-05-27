# 🚀 Global Installation & Usage Guide

## Quick Start with npx/bunx

The easiest way to use Flux Replicate MCP Server is with `npx` or `bunx` - no installation required!

### Option 1: Using npx (Node.js)
```bash
# Set your Replicate API token
export REPLICATE_API_TOKEN="r8_your_token_here"

# Run directly with npx
npx flux-replicate-mcp-server
```

### Option 2: Using bunx (Bun)
```bash
# Set your Replicate API token
export REPLICATE_API_TOKEN="r8_your_token_here"

# Run directly with bunx
bunx flux-replicate-mcp-server
```

## Global Installation

### Install Globally with npm
```bash
npm install -g flux-replicate-mcp-server
```

### Install Globally with Bun
```bash
bun install -g flux-replicate-mcp-server
```

### Run After Global Installation
```bash
# Set your API token
export REPLICATE_API_TOKEN="r8_your_token_here"

# Run the server
flux-replicate-mcp
```

## 🔧 Claude Desktop Integration

### Method 1: Using npx/bunx (Recommended)

Add this to your Claude Desktop MCP configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "flux-replicate": {
      "command": "npx",
      "args": ["flux-replicate-mcp-server"],
      "env": {
        "REPLICATE_API_TOKEN": "r8_your_token_here"
      }
    }
  }
}
```

Or with Bun:
```json
{
  "mcpServers": {
    "flux-replicate": {
      "command": "bunx",
      "args": ["flux-replicate-mcp-server"],
      "env": {
        "REPLICATE_API_TOKEN": "r8_your_token_here"
      }
    }
  }
}
```

### Method 2: Using Global Installation

```json
{
  "mcpServers": {
    "flux-replicate": {
      "command": "flux-replicate-mcp",
      "env": {
        "REPLICATE_API_TOKEN": "r8_your_token_here"
      }
    }
  }
}
```

## 🌍 Environment Configuration

### Required Environment Variables
```bash
# Your Replicate API token (required)
export REPLICATE_API_TOKEN="r8_your_token_here"
```

### Optional Environment Variables
```bash
# Default model (optional)
export FLUX_DEFAULT_MODEL="flux-pro"

# Default output format (optional)
export FLUX_OUTPUT_FORMAT="jpg"

# Default quality (optional)
export FLUX_OUTPUT_QUALITY="80"

# Custom working directory (optional)
export FLUX_WORKING_DIRECTORY="/path/to/custom/directory"
```

## 📁 Working Directories

The server automatically creates platform-specific working directories:

- **Windows**: `%USERPROFILE%\Documents\FluxImages`
- **macOS**: `~/Pictures/FluxImages`
- **Linux**: `~/Pictures/FluxImages` (fallback: `~/flux-images`)

## 🛠️ Usage Examples

### Basic Image Generation
```json
{
  "prompt": "A beautiful sunset over mountains",
  "output_path": "sunset.jpg"
}
```

### Advanced Options
```json
{
  "prompt": "Professional product photo of a smartphone",
  "output_path": "products/smartphone.png",
  "model": "flux-pro",
  "width": 1024,
  "height": 1024,
  "quality": 95
}
```

## 🔍 Troubleshooting

### Common Issues

1. **"REPLICATE_API_TOKEN is required"**
   - Make sure you've set the `REPLICATE_API_TOKEN` environment variable
   - Get your token from [replicate.com](https://replicate.com)

2. **Permission errors on working directory**
   - Set a custom directory with `FLUX_WORKING_DIRECTORY`
   - Ensure the directory is writable

3. **Command not found**
   - For npx/bunx: Ensure Node.js/Bun is installed
   - For global install: Check your PATH includes npm/bun global bin directory

### Getting Help

- Check the [GitHub repository](https://github.com/yourusername/flux-replicate-mcp-server)
- Open an [issue](https://github.com/yourusername/flux-replicate-mcp-server/issues)
- Review the [README.md](README.md) for detailed documentation

## 🎯 Platform-Specific Notes

### Windows
- Use PowerShell or Command Prompt
- Environment variables: `set REPLICATE_API_TOKEN=your_token`
- Working directory: `%USERPROFILE%\Documents\FluxImages`

### macOS
- Use Terminal or iTerm2
- Environment variables: `export REPLICATE_API_TOKEN=your_token`
- Working directory: `~/Pictures/FluxImages`

### Linux
- Use any terminal
- Environment variables: `export REPLICATE_API_TOKEN=your_token`
- Working directory: `~/Pictures/FluxImages` or `~/flux-images`

## 🚀 Next Steps

1. Get your Replicate API token from [replicate.com](https://replicate.com)
2. Choose your preferred installation method (npx/bunx recommended)
3. Configure Claude Desktop with the MCP server
4. Start generating amazing images with Flux models!

---

**Need help?** Check out the [main README](README.md) or open an issue on GitHub! 