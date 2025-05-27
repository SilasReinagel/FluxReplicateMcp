# Flux Replicate MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to generate high-quality images using Flux Pro and Flux Schnell models via Replicate's API.

## Features

- 🎨 **Image Generation**: Generate images using Flux Pro and Flux Schnell models
- 🔧 **Easy Setup**: First-run setup with API key validation
- 📐 **Aspect Ratios**: Support for multiple aspect ratios (1:1, 16:9, 9:16, 4:3, 3:4, 21:9, 9:21)
- 💰 **Cost Tracking**: Transparent cost estimation and reporting
- 🔒 **Secure**: API keys stored securely with proper file permissions
- 🔄 **Retry Logic**: Automatic retry with exponential backoff for transient failures
- ⚡ **Fast**: Built with Bun and TypeScript for optimal performance

## Installation

### Prerequisites

- [Bun](https://bun.sh/) (latest version)
- [Replicate API Key](https://replicate.com/account/api-tokens)

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd FluxReplicateMcp
```

2. Install dependencies:
```bash
bun install
```

3. Build the project:
```bash
bun run build
```

4. Run the server (first-time setup will be prompted):
```bash
bun start
```

## Configuration

The server stores configuration in `~/.flux-replicate-mcp/config.json` with the following structure:

```json
{
  "replicate_api_key": "your-api-key",
  "default_model": "flux-pro",
  "default_aspect_ratio": "1:1",
  "default_output_format": "jpg",
  "default_quality": 80,
  "temp_directory": "./temp",
  "max_concurrent_generations": 3
}
```

## Usage

### MCP Tool: `generate_image`

Generate images using Flux models via the MCP protocol.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | ✅ | - | Text description of the image to generate |
| `output_path` | string | ✅ | - | Local file path where the image will be saved |
| `model` | string | ❌ | `flux-pro` | Model to use: `flux-pro` or `flux-schnell` |
| `aspect_ratio` | string | ❌ | `1:1` | Aspect ratio: `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `21:9`, `9:21` |
| `final_width` | number | ❌ | - | Target width for final processing (future feature) |
| `final_height` | number | ❌ | - | Target height for final processing (future feature) |
| `output_format` | string | ❌ | `jpg` | Output format: `jpg`, `png`, `webp` (future feature) |
| `quality` | number | ❌ | `80` | Quality for lossy formats (1-100) (future feature) |

#### Response

```json
{
  "success": true,
  "local_file_path": "./output/image.jpg",
  "generation_cost": 0.055,
  "model_used": "Flux Pro",
  "original_dimensions": {
    "width": 1024,
    "height": 1024
  },
  "final_dimensions": {
    "width": 1024,
    "height": 1024
  },
  "processing_time": 15420
}
```

### Example Usage

#### Basic Generation
```json
{
  "name": "generate_image",
  "arguments": {
    "prompt": "A serene mountain landscape at sunset",
    "output_path": "./images/mountain_sunset.jpg"
  }
}
```

#### Advanced Generation
```json
{
  "name": "generate_image",
  "arguments": {
    "prompt": "A futuristic cityscape with flying cars",
    "model": "flux-schnell",
    "aspect_ratio": "16:9",
    "output_path": "./images/futuristic_city.jpg"
  }
}
```

## Supported Models

### Flux Pro
- **Model ID**: `black-forest-labs/flux-pro`
- **Quality**: Highest quality output
- **Speed**: Slower generation (~30-60 seconds)
- **Cost**: ~$0.055 per image
- **Best for**: Professional use cases, final artwork

### Flux Schnell
- **Model ID**: `black-forest-labs/flux-schnell`
- **Quality**: Good quality output
- **Speed**: Faster generation (~10-20 seconds)
- **Cost**: ~$0.003 per image
- **Best for**: Rapid prototyping, testing, iterations

## Development

### Scripts

- `bun run build` - Build the project
- `bun run dev` - Run in development mode with watch
- `bun start` - Start the MCP server
- `bun test` - Run tests
- `bun run test:watch` - Run tests in watch mode
- `bun run coverage` - Generate test coverage report
- `bun run lint` - Run ESLint
- `bun run lint:fix` - Fix ESLint issues

### Testing

```bash
# Run all tests
bun test

# Run tests with coverage
bun run coverage

# Run tests in watch mode
bun run test:watch
```

### Project Structure

```
src/
├── index.ts              # Main MCP server entry point
├── config.ts             # Configuration management
├── setup.ts              # First-run setup and API key management
├── replicate-client.ts   # Replicate API client wrapper
└── *.test.ts            # Test files
```

## Roadmap

### Phase 1: Core Functionality ✅
- [x] Basic MCP server framework
- [x] Configuration management
- [x] API key management with setup flow
- [x] Replicate API integration
- [x] Core image generation tool
- [x] Aspect ratio support

### Phase 2: Advanced Features (In Progress)
- [ ] Sharp image processing pipeline
- [ ] Multiple output format support
- [ ] Temporary file management
- [ ] Enhanced error handling
- [ ] Structured logging system

### Phase 3: Polish & Testing
- [ ] Comprehensive test suite
- [ ] Performance optimization
- [ ] Documentation improvements
- [ ] User experience enhancements

### Future Enhancements
- [ ] Batch image generation
- [ ] Image-to-image generation
- [ ] Cloud storage integration
- [ ] Web interface for configuration

## Troubleshooting

### Common Issues

1. **API Key Issues**
   - Ensure your Replicate API key is valid and has sufficient credits
   - API keys should start with `r8_` followed by alphanumeric characters
   - Check your account at https://replicate.com/account

2. **Network Issues**
   - Verify internet connectivity
   - Check if Replicate API is accessible from your network
   - Firewall or proxy settings may interfere

3. **File Permission Issues**
   - Ensure the output directory is writable
   - Check file system permissions for the config directory

### Getting Help

1. Check the error messages in the console output
2. Verify your configuration file at `~/.flux-replicate-mcp/config.json`
3. Test API connectivity with a simple generation
4. Review the logs for detailed error information

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [Replicate](https://replicate.com/) for providing the AI model API
- [Black Forest Labs](https://blackforestlabs.ai/) for the Flux models
- [Model Context Protocol](https://modelcontextprotocol.io/) for the MCP framework 