#!/usr/bin/env node

const { startServer } = require('../src/server');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const command = args[0];

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

// Default devcontainer.json template
const DEFAULT_TEMPLATE = {
  name: 'Development Container',
  image: 'mcr.microsoft.com/devcontainers/base:ubuntu',
  features: {},
  customizations: {
    vscode: {
      extensions: []
    }
  },
  forwardPorts: [],
  postCreateCommand: ''
};

// JSON Schema for validation
const DEVCONTAINER_SCHEMA = {
  required: [],
  recommended: ['name', 'image'],
  validProperties: [
    'name', 'image', 'build', 'dockerFile', 'context', 'dockerComposeFile',
    'service', 'runServices', 'workspaceFolder', 'workspaceMount',
    'shutdownAction', 'overrideCommand', 'features', 'forwardPorts',
    'portsAttributes', 'otherPortsAttributes', 'remoteEnv', 'remoteUser',
    'containerEnv', 'containerUser', 'updateRemoteUserUID', 'userEnvProbe',
    'mounts', 'init', 'privileged', 'capAdd', 'securityOpt', 'runArgs',
    'overrideFeatureInstallOrder', 'customizations', 'onCreateCommand',
    'updateContentCommand', 'postCreateCommand', 'postStartCommand',
    'postAttachCommand', 'waitFor', 'initializeCommand', 'hostRequirements'
  ]
};

// Validate devcontainer.json
function validateConfig(config) {
  const errors = [];
  const warnings = [];
  const suggestions = [];

  // Check if it's an object
  if (typeof config !== 'object' || config === null) {
    errors.push('Configuration must be a JSON object');
    return { errors, warnings, suggestions };
  }

  // Check for image or build
  if (!config.image && !config.build && !config.dockerFile && !config.dockerComposeFile) {
    errors.push('Must specify either "image", "build", "dockerFile", or "dockerComposeFile"');
  }

  // Check for unknown properties
  const knownProps = new Set(DEVCONTAINER_SCHEMA.validProperties);
  for (const key of Object.keys(config)) {
    if (!knownProps.has(key) && !key.startsWith('//')) {
      warnings.push(`Unknown property: "${key}"`);
    }
  }

  // Check recommended properties
  for (const prop of DEVCONTAINER_SCHEMA.recommended) {
    if (!config[prop]) {
      suggestions.push(`Consider adding "${prop}" property`);
    }
  }

  // Check features format
  if (config.features && typeof config.features !== 'object') {
    errors.push('"features" must be an object');
  }

  // Check forwardPorts
  if (config.forwardPorts) {
    if (!Array.isArray(config.forwardPorts)) {
      errors.push('"forwardPorts" must be an array');
    } else {
      for (const port of config.forwardPorts) {
        if (typeof port !== 'number' && typeof port !== 'string') {
          errors.push(`Invalid port in forwardPorts: ${port}`);
        }
      }
    }
  }

  // Check customizations format
  if (config.customizations) {
    if (typeof config.customizations !== 'object') {
      errors.push('"customizations" must be an object');
    } else if (config.customizations.vscode) {
      if (config.customizations.vscode.extensions && !Array.isArray(config.customizations.vscode.extensions)) {
        errors.push('"customizations.vscode.extensions" must be an array');
      }
      if (config.customizations.vscode.settings && typeof config.customizations.vscode.settings !== 'object') {
        errors.push('"customizations.vscode.settings" must be an object');
      }
    }
  }

  // Suggestions for common improvements
  if (!config.postCreateCommand && !config.postStartCommand) {
    suggestions.push('Consider adding "postCreateCommand" for setup scripts');
  }

  if (!config.features || Object.keys(config.features).length === 0) {
    suggestions.push('Consider adding features for common tools (git, docker, etc.)');
  }

  return { errors, warnings, suggestions };
}

// Strip comments from JSONC
function stripJsonComments(jsonc) {
  return jsonc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

// Parse JSONC
function parseJsonc(content) {
  try {
    return JSON.parse(stripJsonComments(content));
  } catch (e) {
    return null;
  }
}

// Find devcontainer.json files
function findDevcontainerFiles(searchPaths) {
  const files = [];

  for (const searchPath of searchPaths) {
    // Check direct .devcontainer/devcontainer.json
    const devcontainerDir = path.join(searchPath, '.devcontainer', 'devcontainer.json');
    if (fs.existsSync(devcontainerDir)) {
      files.push(devcontainerDir);
    }

    // Check root devcontainer.json
    const rootFile = path.join(searchPath, 'devcontainer.json');
    if (fs.existsSync(rootFile)) {
      files.push(rootFile);
    }

    // Check .devcontainer.json
    const dotFile = path.join(searchPath, '.devcontainer.json');
    if (fs.existsSync(dotFile)) {
      files.push(dotFile);
    }
  }

  return files;
}

// Watch for file changes
function watchFiles(searchPaths, callback) {
  const files = findDevcontainerFiles(searchPaths);
  const watchers = [];

  for (const file of files) {
    console.log(`${colors.dim}  Watching: ${file}${colors.reset}`);
    const watcher = fs.watch(file, (eventType) => {
      if (eventType === 'change') {
        callback(file);
      }
    });
    watchers.push(watcher);
  }

  // Also watch directories for new files
  for (const searchPath of searchPaths) {
    const devcontainerDir = path.join(searchPath, '.devcontainer');
    if (fs.existsSync(devcontainerDir)) {
      const watcher = fs.watch(devcontainerDir, (eventType, filename) => {
        if (filename === 'devcontainer.json') {
          const filePath = path.join(devcontainerDir, filename);
          callback(filePath);
        }
      });
      watchers.push(watcher);
    }
  }

  return watchers;
}

// Print banner
function printBanner() {
  console.log(`
  ${colors.cyan}╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   🐳 DevContainer Builder                                 ║
  ║   Visual UI for devcontainer.json                         ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝${colors.reset}
`);
}

// Print help
function printHelp() {
  console.log(`
${colors.cyan}devcontainer-builder${colors.reset} - Visual UI builder for devcontainer.json

${colors.yellow}Usage:${colors.reset}
  npx devcontainer-builder [command] [options] [directories...]

${colors.yellow}Commands:${colors.reset}
  ${colors.green}(default)${colors.reset}    Start the visual editor server
  ${colors.green}init${colors.reset}         Create a new devcontainer.json file
  ${colors.green}validate${colors.reset}     Validate devcontainer.json file(s)

${colors.yellow}Options:${colors.reset}
  -p, --port <number>   Port to run the server on (default: 3000)
  -w, --watch           Watch for file changes and re-validate
  -o, --output <file>   Output file path for init command
  -t, --template <name> Template to use for init (node, python, go, rust, java)
  -h, --help            Show this help message

${colors.yellow}Examples:${colors.reset}
  ${colors.dim}# Start the visual editor${colors.reset}
  npx devcontainer-builder

  ${colors.dim}# Start on a specific port${colors.reset}
  npx devcontainer-builder --port 8080

  ${colors.dim}# Scan multiple directories${colors.reset}
  npx devcontainer-builder ./project1 ./project2

  ${colors.dim}# Create a new devcontainer.json${colors.reset}
  npx devcontainer-builder init
  npx devcontainer-builder init --template node

  ${colors.dim}# Validate existing configuration${colors.reset}
  npx devcontainer-builder validate
  npx devcontainer-builder validate ./my-project

  ${colors.dim}# Watch and validate on changes${colors.reset}
  npx devcontainer-builder validate --watch
`);
}

// Init command
function initCommand(args) {
  let outputPath = path.join(process.cwd(), '.devcontainer', 'devcontainer.json');
  let template = 'default';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o' || args[i] === '--output') {
      outputPath = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '-t' || args[i] === '--template') {
      template = args[i + 1];
      i++;
    }
  }

  // Templates
  const templates = {
    default: DEFAULT_TEMPLATE,
    node: {
      name: 'Node.js Development',
      image: 'mcr.microsoft.com/devcontainers/javascript-node:20',
      features: {
        'ghcr.io/devcontainers/features/node:1': {}
      },
      customizations: {
        vscode: {
          extensions: [
            'dbaeumer.vscode-eslint',
            'esbenp.prettier-vscode'
          ]
        }
      },
      forwardPorts: [3000],
      postCreateCommand: 'npm install'
    },
    python: {
      name: 'Python Development',
      image: 'mcr.microsoft.com/devcontainers/python:3.11',
      features: {
        'ghcr.io/devcontainers/features/python:1': {}
      },
      customizations: {
        vscode: {
          extensions: [
            'ms-python.python',
            'ms-python.vscode-pylance'
          ]
        }
      },
      forwardPorts: [8000],
      postCreateCommand: 'pip install -r requirements.txt'
    },
    go: {
      name: 'Go Development',
      image: 'mcr.microsoft.com/devcontainers/go:1.21',
      features: {
        'ghcr.io/devcontainers/features/go:1': {}
      },
      customizations: {
        vscode: {
          extensions: [
            'golang.go'
          ]
        }
      },
      forwardPorts: [8080],
      postCreateCommand: 'go mod download'
    },
    rust: {
      name: 'Rust Development',
      image: 'mcr.microsoft.com/devcontainers/rust:1',
      features: {
        'ghcr.io/devcontainers/features/rust:1': {}
      },
      customizations: {
        vscode: {
          extensions: [
            'rust-lang.rust-analyzer'
          ]
        }
      },
      forwardPorts: [],
      postCreateCommand: 'cargo build'
    },
    java: {
      name: 'Java Development',
      image: 'mcr.microsoft.com/devcontainers/java:17',
      features: {
        'ghcr.io/devcontainers/features/java:1': {}
      },
      customizations: {
        vscode: {
          extensions: [
            'vscjava.vscode-java-pack'
          ]
        }
      },
      forwardPorts: [8080],
      postCreateCommand: ''
    }
  };

  const config = templates[template] || templates.default;

  // Create directory if needed
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`${colors.green}  ✓${colors.reset} Created directory: ${dir}`);
  }

  // Check if file exists
  if (fs.existsSync(outputPath)) {
    console.log(`${colors.yellow}  ⚠${colors.reset}  File already exists: ${outputPath}`);
    console.log(`${colors.dim}     Use a different path with --output or delete the existing file${colors.reset}`);
    process.exit(1);
  }

  // Write file
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`${colors.green}  ✓${colors.reset} Created: ${outputPath}`);
  console.log(`${colors.dim}     Template: ${template}${colors.reset}`);
  console.log();
  console.log(`${colors.cyan}  Next steps:${colors.reset}`);
  console.log(`${colors.dim}  1. Open the file in VS Code or run: npx devcontainer-builder${colors.reset}`);
  console.log(`${colors.dim}  2. Customize the configuration for your project${colors.reset}`);
  console.log(`${colors.dim}  3. Rebuild the container in VS Code${colors.reset}`);
}

// Validate command
function validateCommand(args) {
  let searchPaths = [];
  let watch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-w' || args[i] === '--watch') {
      watch = true;
    } else if (!args[i].startsWith('-')) {
      const resolvedPath = path.resolve(args[i]);
      if (fs.existsSync(resolvedPath)) {
        searchPaths.push(resolvedPath);
      } else {
        console.warn(`${colors.yellow}  ⚠${colors.reset}  Path not found: ${args[i]}`);
      }
    }
  }

  if (searchPaths.length === 0) {
    searchPaths.push(process.cwd());
  }

  const validateFiles = () => {
    const files = findDevcontainerFiles(searchPaths);

    if (files.length === 0) {
      console.log(`${colors.yellow}  ⚠${colors.reset}  No devcontainer.json files found`);
      console.log(`${colors.dim}     Run 'npx devcontainer-builder init' to create one${colors.reset}`);
      return false;
    }

    let hasErrors = false;

    for (const file of files) {
      console.log(`\n${colors.cyan}  Validating:${colors.reset} ${file}`);

      const content = fs.readFileSync(file, 'utf-8');
      const config = parseJsonc(content);

      if (!config) {
        console.log(`${colors.red}  ✗ Invalid JSON${colors.reset}`);
        hasErrors = true;
        continue;
      }

      const result = validateConfig(config);

      if (result.errors.length === 0 && result.warnings.length === 0) {
        console.log(`${colors.green}  ✓ Valid${colors.reset}`);
      }

      for (const error of result.errors) {
        console.log(`${colors.red}  ✗ Error:${colors.reset} ${error}`);
        hasErrors = true;
      }

      for (const warning of result.warnings) {
        console.log(`${colors.yellow}  ⚠ Warning:${colors.reset} ${warning}`);
      }

      for (const suggestion of result.suggestions) {
        console.log(`${colors.dim}  💡 Suggestion: ${suggestion}${colors.reset}`);
      }
    }

    return !hasErrors;
  };

  // Initial validation
  const valid = validateFiles();

  if (watch) {
    console.log(`\n${colors.cyan}  Watching for changes...${colors.reset} (Ctrl+C to stop)`);

    watchFiles(searchPaths, (file) => {
      console.log(`\n${colors.dim}  File changed: ${file}${colors.reset}`);
      validateFiles();
    });
  } else {
    process.exit(valid ? 0 : 1);
  }
}

// Main server command
function serverCommand(args) {
  let port = 3000;
  let searchPaths = [];
  let watch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' || args[i] === '-p') {
      port = parseInt(args[i + 1], 10) || 3000;
      i++;
    } else if (args[i] === '--watch' || args[i] === '-w') {
      watch = true;
    } else if (!args[i].startsWith('-')) {
      const resolvedPath = path.resolve(args[i]);
      if (fs.existsSync(resolvedPath)) {
        searchPaths.push(resolvedPath);
      } else {
        console.warn(`${colors.yellow}  ⚠${colors.reset}  Path not found: ${args[i]}`);
      }
    }
  }

  if (searchPaths.length === 0) {
    searchPaths.push(process.cwd());
  }

  printBanner();
  console.log(`  📂 Scanning ${searchPaths.length} director${searchPaths.length === 1 ? 'y' : 'ies'}...`);

  startServer(port, searchPaths);

  if (watch) {
    console.log(`\n${colors.cyan}  Watching for changes...${colors.reset}`);
    watchFiles(searchPaths, (file) => {
      console.log(`${colors.dim}  File changed: ${file} - Refresh browser to see changes${colors.reset}`);
    });
  }
}

// Main entry point
if (command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
} else if (command === 'init') {
  printBanner();
  initCommand(args.slice(1));
} else if (command === 'validate') {
  printBanner();
  validateCommand(args.slice(1));
} else {
  serverCommand(args);
}
