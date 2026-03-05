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

function startServer(port, devcontainerPath) {
  const publicDir = path.join(__dirname, '..', 'public');

  // Load existing devcontainer.json or use default
  let devcontainerData = getDefaultDevcontainer();
  if (devcontainerPath && fs.existsSync(devcontainerPath)) {
    try {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      devcontainerData = JSON.parse(content);
    } catch (e) {
      console.log(`  ⚠️  Could not parse ${devcontainerPath}, using default config`);
    }
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = url.pathname;

    // API endpoints
    if (pathname === '/api/config' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(devcontainerData, null, 2));
      return;
    }

    if (pathname === '/api/config' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          devcontainerData = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    if (pathname === '/api/save' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const savePath = devcontainerPath || path.join(process.cwd(), '.devcontainer', 'devcontainer.json');

          // Ensure directory exists
          const dir = path.dirname(savePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(savePath, JSON.stringify(data, null, 2));
          devcontainerData = data;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, path: savePath }));
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
