#!/usr/bin/env node

const { startServer } = require('../src/server');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

// Parse arguments
let port = 3000;
let searchPaths = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' || args[i] === '-p') {
    port = parseInt(args[i + 1], 10) || 3000;
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
devcontainer-builder - Visual UI builder for devcontainer.json

Usage:
  npx devcontainer-builder [options] [directories...]

Options:
  -p, --port <number>   Port to run the server on (default: 3000)
  -h, --help            Show this help message

Arguments:
  directories           One or more directories to scan for devcontainer.json files
                        (default: current directory)

Examples:
  npx devcontainer-builder
  npx devcontainer-builder --port 8080
  npx devcontainer-builder ./project1 ./project2
  npx devcontainer-builder ~/projects/*
`);
    process.exit(0);
  } else if (!args[i].startsWith('-')) {
    const resolvedPath = path.resolve(args[i]);
    if (fs.existsSync(resolvedPath)) {
      searchPaths.push(resolvedPath);
    } else {
      console.warn(`  ⚠️  Path not found: ${args[i]}`);
    }
  }
}

// Default to current directory if no paths specified
if (searchPaths.length === 0) {
  searchPaths.push(process.cwd());
}

console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   🐳 DevContainer Builder                                 ║
  ║   Visual UI for devcontainer.json                         ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
`);

console.log(`  📂 Scanning ${searchPaths.length} director${searchPaths.length === 1 ? 'y' : 'ies'}...`);

startServer(port, searchPaths);
