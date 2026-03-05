const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function startServer(port, searchPaths) {
  const publicDir = path.join(__dirname, '..', 'public');

  // State management for multiple files
  const state = {
    files: [],           // List of found devcontainer.json files
    currentIndex: 0,     // Currently selected file index
    configs: {},         // Cached configurations by path
  };

  // Scan for devcontainer.json files
  function scanForFiles() {
    state.files = [];
    for (const searchPath of searchPaths) {
      const found = findDevcontainerFiles(searchPath);
      state.files.push(...found);
    }
    // Remove duplicates
    state.files = [...new Set(state.files)];

    // Load all configs
    for (const filePath of state.files) {
      loadConfig(filePath);
    }

    return state.files;
  }

  function findDevcontainerFiles(startPath) {
    const results = [];

    // Check common locations
    const possiblePaths = [
      path.join(startPath, '.devcontainer', 'devcontainer.json'),
      path.join(startPath, '.devcontainer.json'),
      path.join(startPath, 'devcontainer.json'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        results.push(p);
      }
    }

    // Also check for nested devcontainers (like .devcontainer/codespaces/devcontainer.json)
    const devcontainerDir = path.join(startPath, '.devcontainer');
    if (fs.existsSync(devcontainerDir) && fs.statSync(devcontainerDir).isDirectory()) {
      try {
        const entries = fs.readdirSync(devcontainerDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const nestedPath = path.join(devcontainerDir, entry.name, 'devcontainer.json');
            if (fs.existsSync(nestedPath)) {
              results.push(nestedPath);
            }
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }

    return results;
  }

  function loadConfig(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      state.configs[filePath] = JSON.parse(content);
    } catch (e) {
      console.log(`  ⚠️  Could not parse ${filePath}`);
      state.configs[filePath] = getDefaultDevcontainer();
    }
  }

  function getCurrentConfig() {
    if (state.files.length === 0) {
      return getDefaultDevcontainer();
    }
    const currentPath = state.files[state.currentIndex];
    return state.configs[currentPath] || getDefaultDevcontainer();
  }

  function getCurrentPath() {
    if (state.files.length === 0) {
      return null;
    }
    return state.files[state.currentIndex];
  }

  // Initial scan
  scanForFiles();

  if (state.files.length > 0) {
    console.log(`  📁 Found ${state.files.length} devcontainer.json file(s):`);
    state.files.forEach((f, i) => {
      console.log(`     ${i === 0 ? '→' : ' '} ${f}`);
    });
  } else {
    console.log(`  📁 No devcontainer.json found - starting with empty config`);
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = url.pathname;

    // CORS headers for API
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // API: List all files
    if (pathname === '/api/files' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        files: state.files.map((f, i) => ({
          index: i,
          path: f,
          name: getDisplayName(f),
          current: i === state.currentIndex,
        })),
        currentIndex: state.currentIndex,
      }));
      return;
    }

    // API: Switch to a different file
    if (pathname === '/api/files/select' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { index } = JSON.parse(body);
          if (index >= 0 && index < state.files.length) {
            state.currentIndex = index;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              currentPath: getCurrentPath(),
              config: getCurrentConfig(),
            }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid index' }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid request' }));
        }
      });
      return;
    }

    // API: Refresh file list
    if (pathname === '/api/files/refresh' && req.method === 'POST') {
      scanForFiles();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        files: state.files.map((f, i) => ({
          index: i,
          path: f,
          name: getDisplayName(f),
          current: i === state.currentIndex,
        })),
      }));
      return;
    }

    // API: Add a new file path to scan
    if (pathname === '/api/files/add' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { path: newPath } = JSON.parse(body);
          if (newPath && fs.existsSync(newPath)) {
            if (!state.files.includes(newPath)) {
              state.files.push(newPath);
              loadConfig(newPath);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, files: state.files }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File not found' }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // API: Get current config
    if (pathname === '/api/config' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...getCurrentConfig(),
        _meta: {
          path: getCurrentPath(),
          index: state.currentIndex,
          totalFiles: state.files.length,
        }
      }, null, 2));
      return;
    }

    // API: Update current config
    if (pathname === '/api/config' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          delete data._meta; // Remove metadata if present
          const currentPath = getCurrentPath();
          if (currentPath) {
            state.configs[currentPath] = data;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // API: Save current config to file
    if (pathname === '/api/save' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          delete data._meta; // Remove metadata if present

          let savePath = getCurrentPath();
          if (!savePath) {
            savePath = path.join(searchPaths[0] || process.cwd(), '.devcontainer', 'devcontainer.json');
          }

          // Ensure directory exists
          const dir = path.dirname(savePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(savePath, JSON.stringify(data, null, 2));
          state.configs[savePath] = data;

          // Add to files list if new
          if (!state.files.includes(savePath)) {
            state.files.push(savePath);
            state.currentIndex = state.files.length - 1;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, path: savePath }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // API: Create new devcontainer.json
    if (pathname === '/api/files/create' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { directory, name } = JSON.parse(body);
          const newPath = path.join(directory, '.devcontainer', 'devcontainer.json');

          // Ensure directory exists
          const dir = path.dirname(newPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          const newConfig = {
            ...getDefaultDevcontainer(),
            name: name || 'Dev Container',
          };

          fs.writeFileSync(newPath, JSON.stringify(newConfig, null, 2));
          state.files.push(newPath);
          state.configs[newPath] = newConfig;
          state.currentIndex = state.files.length - 1;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, path: newPath, config: newConfig }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // Serve static files
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(publicDir, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // Serve index.html for SPA routing
          fs.readFile(path.join(publicDir, 'index.html'), (err, content) => {
            if (err) {
              res.writeHead(404);
              res.end('Not Found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(content);
            }
          });
        } else {
          res.writeHead(500);
          res.end('Server Error');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });

  server.listen(port, () => {
    console.log(`  🚀 Server running at http://localhost:${port}`);
    console.log(`  📝 Press Ctrl+C to stop\n`);
  });

  return server;
}

function getDisplayName(filePath) {
  // Extract a readable name from the path
  const parts = filePath.split(path.sep);
  const devcontainerIndex = parts.lastIndexOf('.devcontainer');

  if (devcontainerIndex > 0) {
    const projectName = parts[devcontainerIndex - 1];
    const subdir = parts[devcontainerIndex + 1];
    if (subdir && subdir !== 'devcontainer.json') {
      return `${projectName} (${subdir})`;
    }
    return projectName;
  }

  return path.basename(path.dirname(filePath));
}

function getDefaultDevcontainer() {
  return {
    name: "Dev Container",
    image: "mcr.microsoft.com/devcontainers/base:ubuntu",
    features: {},
    customizations: {
      vscode: {
        extensions: [],
        settings: {}
      }
    },
    forwardPorts: [],
    postCreateCommand: "",
    remoteUser: "vscode"
  };
}

module.exports = { startServer };
