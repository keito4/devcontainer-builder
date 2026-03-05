#!/usr/bin/env node

const { startServer } = require('../src/server');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

// Parse arguments
let port = 3000;
let configPath = process.cwd();

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' || args[i] === '-p') {
    port = parseInt(args[i + 1], 10) || 3000;
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
devcontainer-builder - Visual UI builder for devcontainer.json

Usage:
  npx devcontainer-builder [options]

Options:
  -p, --port <number>   Port to run the server on (default: 3000)
  -h, --help            Show this help message

Examples:
  npx devcontainer-builder
  npx devcontainer-builder --port 8080
`);
    process.exit(0);
  } else if (!args[i].startsWith('-')) {
    configPath = path.resolve(args[i]);
  }
}

// Find devcontainer.json
function findDevcontainerJson(startPath) {
  const possiblePaths = [
    path.join(startPath, '.devcontainer', 'devcontainer.json'),
    path.join(startPath, '.devcontainer.json'),
    path.join(startPath, 'devcontainer.json'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

const devcontainerPath = findDevcontainerJson(configPath);

console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   🐳 DevContainer Builder                                 ║
  ║   Visual UI for devcontainer.json                         ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
`);

if (devcontainerPath) {
  console.log(`  📁 Found: ${devcontainerPath}`);
} else {
  console.log(`  📁 No devcontainer.json found - starting with empty config`);
}

startServer(port, devcontainerPath);
