# Flux Replicate MCP Server

A **simple** Model Context Protocol (MCP) server for generating images using Flux Pro and Flux Schnell models via the Replicate API.

## ✨ Simplicity First

This server has been designed with simplicity as the primary goal:
- **751 lines of code** (down from 3,200+ LOC)
- **7 files** (down from 15+ files)
- **Environment variable configuration** (no complex config files)
- **Platform-specific working directories** (automatically organized)
- **Essential functionality only** (image generation that just works)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

Copy the example environment file and add your Replicate API token:

```bash
cp .env.example .env
```

Edit `.env` and add your Replicate API token:

```env
REPLICATE_API_TOKEN=r8_your_token_here
```

### 3. Build and Run

```bash
bun run build
bun run start
```

The server will automatically create a platform-specific working directory for your generated images:
- **Windows**: `%USERPROFILE%\Documents\FluxImages`
- **macOS**: `~/Pictures/FluxImages`
- **Linux**: `~/Pictures/FluxImages` (fallback: `~/flux-images`)

## 🔧 Configuration

All configuration is done via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REPLICATE_API_TOKEN` | ✅ | - | Your Replicate API token |
| `FLUX_DEFAULT_MODEL` | ❌ | `flux-pro` | Default model (`flux-pro` or `flux-schnell`) |
| `FLUX_OUTPUT_FORMAT` | ❌ | `jpg` | Default output format (`jpg`, `png`, `webp`) |
| `FLUX_OUTPUT_QUALITY` | ❌ | `80` | Default quality for lossy formats (1-100) |
| `FLUX_WORKING_DIRECTORY` | ❌ | Platform-specific | Custom working directory for generated images |

## 🛠️ Available Tools

### `generate_image`

Generate images using Flux models.

**Parameters:**
- `prompt` (required): Text description of the image to generate
- `output_path` (required): Filename or relative path within working directory (absolute paths converted to working directory)
- `model` (optional): Flux model to use (`flux-pro` or `flux-schnell`)
- `width` (optional): Image width in pixels (default: 1024)
- `height` (optional): Image height in pixels (default: 1024)
- `quality` (optional): Image quality for lossy formats (1-100)

**Example:**
```json
{
  "prompt": "A serene mountain landscape at sunset",
  "output_path": "mountain_sunset.jpg",
  "model": "flux-pro",
  "width": 1024,
  "height": 1024,
  "quality": 90
}
```

**Working Directory Behavior:**
- `"image.jpg"` → Saved to working directory as `image.jpg`
- `"subfolder/image.jpg"` → Saved to working directory as `subfolder/image.jpg`
- `"/absolute/path/image.jpg"` → Converted to working directory as `image.jpg`

## 📁 Architecture

The simplified codebase consists of just 7 focused files:

```
src/
├── index.ts           # MCP server (290+ LOC)
├── replicate.ts       # Replicate API client (170+ LOC)
├── image.ts           # Image processing with Sharp (124 LOC)
├── temp.ts            # Basic temp file management (73 LOC)
├── errors.ts          # Simple error handling (58 LOC)
├── config.ts          # Environment-based config (80+ LOC)
└── log.ts             # Basic JSON logging (38 LOC)
```

## 🎯 Design Philosophy

This server follows the principle: **"Simple enough to understand in 30 minutes, powerful enough to generate great images"**

### What We Kept
- ✅ Core image generation with Flux Pro/Schnell
- ✅ Image processing and format conversion
- ✅ Platform-specific working directories
- ✅ Basic error handling and logging
- ✅ MCP protocol compliance

### What We Removed
- ❌ Complex configuration management
- ❌ Extensive validation and retry logic
- ❌ Performance tracking and cost analysis
- ❌ File-based configuration and migrations
- ❌ Comprehensive test suites
- ❌ Setup wizards and health checks

## 🔗 MCP Integration

### Claude Desktop

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "flux-replicate": {
      "command": "bun",
      "args": ["run", "/path/to/flux-replicate-mcp-server/dist/index.js"],
      "env": {
        "REPLICATE_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

## 🚨 Error Handling

The server uses simple error codes:
- `AUTH`: Authentication/API key issues
- `API`: Replicate API errors
- `VALIDATION`: Invalid input parameters
- `PROCESSING`: Image processing failures

All errors are logged as structured JSON to stderr for MCP compatibility.

## 📝 Development

### Build
```bash
bun run build
```

### Development Mode
```bash
bun run dev
```

## 📄 License

MIT

---

**Note:** This is a simplified version focused on core functionality. For advanced features like retry logic, performance tracking, or complex validation, consider the full-featured version. 