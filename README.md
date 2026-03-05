# devcontainer-builder

Visual UI builder for devcontainer.json configuration files.

![npm version](https://img.shields.io/npm/v/devcontainer-builder)
![license](https://img.shields.io/npm/l/devcontainer-builder)

## Features

- Visual editor for devcontainer.json
- Edit features, extensions, settings, environment variables
- Configure mounts, ports, and lifecycle commands
- Real-time JSON preview
- Save directly to file or download

## Installation

```bash
# Run directly with npx (no installation required)
npx devcontainer-builder

# Or install globally
npm install -g devcontainer-builder
devcontainer-builder
```

## Usage

```bash
# Start the builder in the current directory
npx devcontainer-builder

# Specify a custom port
npx devcontainer-builder --port 8080

# Show help
npx devcontainer-builder --help
```

The builder will:
1. Look for an existing devcontainer.json in:
   - `.devcontainer/devcontainer.json`
   - `.devcontainer.json`
   - `devcontainer.json`
2. Start a local server (default port 3000)
3. Open the visual editor in your browser

## Screenshots

The UI provides sections for:
- **Base Image**: Configure container name and image
- **Features**: Add/remove Dev Container features with options
- **Lifecycle Commands**: postCreateCommand, postStartCommand
- **VS Code Extensions**: Add extensions by ID
- **VS Code Settings**: Configure editor settings
- **Environment Variables**: containerEnv and remoteEnv
- **Port Forwarding**: Configure forwarded ports
- **Bind Mounts**: Add volume mounts

## API

The builder also exposes a simple HTTP API:

- `GET /api/config` - Get current configuration
- `POST /api/config` - Update configuration in memory
- `POST /api/save` - Save configuration to devcontainer.json file

## Development

```bash
# Clone the repository
git clone https://github.com/keito4/devcontainer-builder.git
cd devcontainer-builder

# Install dependencies
npm install

# Run locally
node bin/cli.js
```

## Testing

E2E tests are written with Playwright.

```bash
# Install Playwright browsers
npx playwright install

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests in headed mode
npm run test:headed
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
