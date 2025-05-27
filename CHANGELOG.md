# Changelog

## [2.0.0] - Simplified Version

### 🎯 Major Simplification

This release represents a complete simplification of the Flux Replicate MCP Server, reducing complexity while maintaining core functionality.

### 📊 Metrics

- **Lines of Code**: 751 (down from 3,200+ LOC) - **76% reduction**
- **File Count**: 7 files (down from 15+ files) - **53% reduction**
- **Dependencies**: 3 runtime deps (down from 4) - removed Zod validation
- **Configuration**: Environment variables only (no config files)

### ✅ What We Kept

- Core image generation with Flux Pro and Flux Schnell models
- Image processing and format conversion with Sharp
- Basic error handling and structured logging
- Full MCP protocol compliance
- Essential file management

### ❌ What We Removed

- Complex configuration management and file-based config
- Extensive validation and retry logic with exponential backoff
- Performance tracking and cost analysis
- Setup wizards and health checks
- Comprehensive test suites (2,683 LOC of tests)
- File-based logging and log rotation
- Configuration migrations and backups
- Path validation and security checks
- Disk space monitoring

### 🏗️ Architecture Changes

**New Simplified Structure:**
```
src/
├── index.ts           # MCP server (263 LOC)
├── replicate.ts       # Replicate API client (146 LOC)
├── image.ts           # Image processing (124 LOC)
├── temp.ts            # Basic temp management (73 LOC)
├── errors.ts          # Simple error handling (58 LOC)
├── config.ts          # Environment config (49 LOC)
└── log.ts             # Basic logging (38 LOC)
```

### 🔧 Configuration Changes

**Before:** Complex JSON configuration file with 15+ options
**After:** Simple environment variables:
- `REPLICATE_API_TOKEN` (required)
- `FLUX_DEFAULT_MODEL` (optional)
- `FLUX_OUTPUT_FORMAT` (optional)
- `FLUX_OUTPUT_QUALITY` (optional)

### 🚀 Benefits

- **Faster startup**: No complex initialization or health checks
- **Easier deployment**: Just set environment variables
- **Simpler debugging**: Fewer moving parts, clearer error messages
- **Lower maintenance**: Less code to maintain and update
- **Better understanding**: Can be understood in 30 minutes

### 🔄 Migration Guide

If migrating from the complex version:

1. **Configuration**: Convert your `~/.flux-replicate-mcp/config.json` to environment variables
2. **Error Handling**: Update any error handling code to use the new simple error types
3. **Logging**: Switch from file-based to stderr JSON logging
4. **Dependencies**: Remove any references to removed features

### 🎯 Philosophy

This version follows the principle: **"Simple enough to understand in 30 minutes, powerful enough to generate great images"**

---

## [1.0.0] - Complex Version (Archived)

The original full-featured version with comprehensive error handling, performance tracking, cost analysis, and extensive configuration options. This version is preserved for reference but is no longer actively maintained.

### Features (Archived)
- Complex configuration management with migrations
- Comprehensive error handling with retry logic
- Performance and cost tracking
- Extensive validation and security checks
- File-based logging with rotation
- Setup wizards and health checks
- Full test coverage (2,683 LOC of tests) 