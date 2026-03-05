const http = require('http');
const https = require('https');
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

// Cache for external API responses
const cache = {
  features: null,
  featuresTimestamp: 0,
  extensions: {},
  CACHE_TTL: 1000 * 60 * 30, // 30 minutes
};

// Popular/recommended features
const POPULAR_FEATURES = [
  { id: 'ghcr.io/devcontainers/features/node:1', name: 'Node.js', description: 'Installs Node.js, nvm, yarn, and pnpm', category: 'Languages' },
  { id: 'ghcr.io/devcontainers/features/python:1', name: 'Python', description: 'Installs Python, pip, pipx, and venv', category: 'Languages' },
  { id: 'ghcr.io/devcontainers/features/go:1', name: 'Go', description: 'Installs Go and common tools', category: 'Languages' },
  { id: 'ghcr.io/devcontainers/features/rust:1', name: 'Rust', description: 'Installs Rust, rustup, and cargo', category: 'Languages' },
  { id: 'ghcr.io/devcontainers/features/java:1', name: 'Java', description: 'Installs Java JDK and related tools', category: 'Languages' },
  { id: 'ghcr.io/devcontainers/features/docker-in-docker:2', name: 'Docker-in-Docker', description: 'Run Docker inside the container', category: 'Tools' },
  { id: 'ghcr.io/devcontainers/features/docker-outside-of-docker:1', name: 'Docker-outside-of-Docker', description: 'Access host Docker from container', category: 'Tools' },
  { id: 'ghcr.io/devcontainers/features/git:1', name: 'Git', description: 'Installs Git and Git LFS', category: 'Tools' },
  { id: 'ghcr.io/devcontainers/features/github-cli:1', name: 'GitHub CLI', description: 'Installs GitHub CLI (gh)', category: 'Tools' },
  { id: 'ghcr.io/devcontainers/features/azure-cli:1', name: 'Azure CLI', description: 'Installs Azure CLI', category: 'Cloud' },
  { id: 'ghcr.io/devcontainers/features/aws-cli:1', name: 'AWS CLI', description: 'Installs AWS CLI v2', category: 'Cloud' },
  { id: 'ghcr.io/devcontainers/features/kubectl-helm-minikube:1', name: 'Kubernetes Tools', description: 'Installs kubectl, Helm, and Minikube', category: 'Cloud' },
  { id: 'ghcr.io/devcontainers/features/terraform:1', name: 'Terraform', description: 'Installs Terraform and TFLint', category: 'Infrastructure' },
  { id: 'ghcr.io/devcontainers/features/sshd:1', name: 'SSH Server', description: 'Adds SSH server to container', category: 'Tools' },
  { id: 'ghcr.io/devcontainers/features/common-utils:2', name: 'Common Utilities', description: 'Common utilities like zsh, oh-my-zsh', category: 'Tools' },
];

// Templates for quick start
const TEMPLATES = [
  {
    id: 'node',
    name: 'Node.js',
    description: 'Node.js development with TypeScript support',
    icon: 'JS',
    config: {
      name: 'Node.js Dev Container',
      image: 'mcr.microsoft.com/devcontainers/javascript-node:20',
      features: {
        'ghcr.io/devcontainers/features/node:1': { version: '20' }
      },
      customizations: {
        vscode: {
          extensions: [
            'dbaeumer.vscode-eslint',
            'esbenp.prettier-vscode',
            'bradlc.vscode-tailwindcss'
          ],
          settings: {
            'editor.formatOnSave': true,
            'editor.defaultFormatter': 'esbenp.prettier-vscode'
          }
        }
      },
      forwardPorts: [3000],
      postCreateCommand: 'npm install'
    }
  },
  {
    id: 'python',
    name: 'Python',
    description: 'Python development with pip and venv',
    icon: 'PY',
    config: {
      name: 'Python Dev Container',
      image: 'mcr.microsoft.com/devcontainers/python:3.11',
      features: {
        'ghcr.io/devcontainers/features/python:1': { version: '3.11' }
      },
      customizations: {
        vscode: {
          extensions: [
            'ms-python.python',
            'ms-python.vscode-pylance',
            'ms-python.black-formatter'
          ],
          settings: {
            'python.defaultInterpreterPath': '/usr/local/bin/python',
            'editor.formatOnSave': true
          }
        }
      },
      forwardPorts: [8000],
      postCreateCommand: 'pip install -r requirements.txt || true'
    }
  },
  {
    id: 'go',
    name: 'Go',
    description: 'Go development environment',
    icon: 'GO',
    config: {
      name: 'Go Dev Container',
      image: 'mcr.microsoft.com/devcontainers/go:1.21',
      features: {
        'ghcr.io/devcontainers/features/go:1': { version: '1.21' }
      },
      customizations: {
        vscode: {
          extensions: [
            'golang.go'
          ],
          settings: {
            'go.toolsManagement.autoUpdate': true,
            'editor.formatOnSave': true
          }
        }
      },
      forwardPorts: [8080],
      postCreateCommand: 'go mod download || true'
    }
  },
  {
    id: 'rust',
    name: 'Rust',
    description: 'Rust development with cargo',
    icon: 'RS',
    config: {
      name: 'Rust Dev Container',
      image: 'mcr.microsoft.com/devcontainers/rust:latest',
      features: {
        'ghcr.io/devcontainers/features/rust:1': {}
      },
      customizations: {
        vscode: {
          extensions: [
            'rust-lang.rust-analyzer',
            'tamasfe.even-better-toml'
          ],
          settings: {
            'editor.formatOnSave': true
          }
        }
      },
      postCreateCommand: 'cargo build || true'
    }
  },
  {
    id: 'java',
    name: 'Java',
    description: 'Java development with Maven/Gradle',
    icon: 'JV',
    config: {
      name: 'Java Dev Container',
      image: 'mcr.microsoft.com/devcontainers/java:17',
      features: {
        'ghcr.io/devcontainers/features/java:1': { version: '17' }
      },
      customizations: {
        vscode: {
          extensions: [
            'vscjava.vscode-java-pack',
            'vscjava.vscode-maven'
          ]
        }
      },
      forwardPorts: [8080],
      postCreateCommand: './mvnw install || ./gradlew build || true'
    }
  },
  {
    id: 'fullstack',
    name: 'Full Stack',
    description: 'Node.js + PostgreSQL + Redis',
    icon: 'FS',
    config: {
      name: 'Full Stack Dev Container',
      image: 'mcr.microsoft.com/devcontainers/javascript-node:20',
      features: {
        'ghcr.io/devcontainers/features/node:1': { version: '20' },
        'ghcr.io/devcontainers/features/docker-in-docker:2': {}
      },
      customizations: {
        vscode: {
          extensions: [
            'dbaeumer.vscode-eslint',
            'esbenp.prettier-vscode',
            'ms-azuretools.vscode-docker',
            'mtxr.sqltools',
            'mtxr.sqltools-driver-pg'
          ]
        }
      },
      forwardPorts: [3000, 5432, 6379],
      postCreateCommand: 'npm install'
    }
  },
  {
    id: 'devops',
    name: 'DevOps',
    description: 'Docker, Kubernetes, Terraform',
    icon: 'DO',
    config: {
      name: 'DevOps Dev Container',
      image: 'mcr.microsoft.com/devcontainers/base:ubuntu',
      features: {
        'ghcr.io/devcontainers/features/docker-in-docker:2': {},
        'ghcr.io/devcontainers/features/kubectl-helm-minikube:1': {},
        'ghcr.io/devcontainers/features/terraform:1': {},
        'ghcr.io/devcontainers/features/azure-cli:1': {},
        'ghcr.io/devcontainers/features/aws-cli:1': {}
      },
      customizations: {
        vscode: {
          extensions: [
            'ms-azuretools.vscode-docker',
            'ms-kubernetes-tools.vscode-kubernetes-tools',
            'hashicorp.terraform'
          ]
        }
      }
    }
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Bare Ubuntu with basic tools',
    icon: 'MN',
    config: {
      name: 'Minimal Dev Container',
      image: 'mcr.microsoft.com/devcontainers/base:ubuntu',
      features: {
        'ghcr.io/devcontainers/features/common-utils:2': {}
      },
      remoteUser: 'vscode'
    }
  }
];

// JSON Schema for validation (simplified)
const DEVCONTAINER_SCHEMA = {
  required: [],
  recommended: ['name', 'image'],
  deprecated: ['runArgs'], // Example
  properties: {
    name: { type: 'string', description: 'A name for the dev container' },
    image: { type: 'string', description: 'The docker image to use' },
    build: { type: 'object', description: 'Build configuration for Dockerfile' },
    features: { type: 'object', description: 'Dev container features to install' },
    forwardPorts: { type: 'array', description: 'Ports to forward from the container' },
    customizations: { type: 'object', description: 'Tool-specific customizations' },
    postCreateCommand: { type: ['string', 'array'], description: 'Command to run after creating the container' },
    postStartCommand: { type: ['string', 'array'], description: 'Command to run after starting the container' },
    postAttachCommand: { type: ['string', 'array'], description: 'Command to run after attaching to the container' },
    remoteUser: { type: 'string', description: 'The user VS Code should run as in the container' },
    containerUser: { type: 'string', description: 'The user the container should run as' },
    containerEnv: { type: 'object', description: 'Environment variables for the container' },
    remoteEnv: { type: 'object', description: 'Environment variables for VS Code remote' },
    mounts: { type: 'array', description: 'Mounts to add to the container' },
    workspaceFolder: { type: 'string', description: 'The path of the workspace folder inside the container' },
    workspaceMount: { type: 'string', description: 'Mount configuration for the workspace' },
    shutdownAction: { type: 'string', description: 'Action when closing VS Code', enum: ['none', 'stopContainer'] },
    overrideCommand: { type: 'boolean', description: 'Override the default command' },
    privileged: { type: 'boolean', description: 'Run container in privileged mode' },
    capAdd: { type: 'array', description: 'Linux capabilities to add' },
    securityOpt: { type: 'array', description: 'Security options' },
  },
  help: {
    name: 'Display name shown in VS Code UI',
    image: 'Use mcr.microsoft.com/devcontainers/* for official images',
    features: 'Add tools and runtimes from ghcr.io/devcontainers/features/*',
    forwardPorts: 'Automatically forward these ports when container starts',
    postCreateCommand: 'Run once after container creation (e.g., npm install)',
    postStartCommand: 'Run every time container starts',
    remoteUser: 'User for VS Code operations (usually "vscode" or "root")',
    mounts: 'Add bind mounts for persistent data or host access',
  }
};

// Helper to make HTTPS requests
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'devcontainer-builder' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Search VS Code marketplace
async function searchExtensions(query) {
  const cacheKey = query.toLowerCase();
  if (cache.extensions[cacheKey] && Date.now() - cache.extensions[cacheKey].timestamp < cache.CACHE_TTL) {
    return cache.extensions[cacheKey].data;
  }

  try {
    const searchUrl = `https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery`;
    const body = JSON.stringify({
      filters: [{
        criteria: [
          { filterType: 8, value: 'Microsoft.VisualStudio.Code' },
          { filterType: 10, value: query }
        ],
        pageNumber: 1,
        pageSize: 20,
        sortBy: 0,
        sortOrder: 0
      }],
      assetTypes: [],
      flags: 914
    });

    return new Promise((resolve) => {
      const req = https.request(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json;api-version=3.0-preview.1',
          'User-Agent': 'devcontainer-builder'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const results = (json.results?.[0]?.extensions || []).map(ext => ({
              id: `${ext.publisher.publisherName}.${ext.extensionName}`,
              name: ext.displayName,
              publisher: ext.publisher.publisherName,
              description: ext.shortDescription || '',
              installs: ext.statistics?.find(s => s.statisticName === 'install')?.value || 0,
              rating: ext.statistics?.find(s => s.statisticName === 'averagerating')?.value || 0,
              icon: ext.versions?.[0]?.files?.find(f => f.assetType === 'Microsoft.VisualStudio.Services.Icons.Small')?.source
            }));
            cache.extensions[cacheKey] = { data: results, timestamp: Date.now() };
            resolve(results);
          } catch (e) {
            resolve([]);
          }
        });
      });
      req.on('error', () => resolve([]));
      req.setTimeout(10000, () => { req.destroy(); resolve([]); });
      req.write(body);
      req.end();
    });
  } catch (e) {
    return [];
  }
}

// Validate devcontainer.json
function validateConfig(config) {
  const warnings = [];
  const errors = [];
  const suggestions = [];

  // Check for required/recommended fields
  if (!config.name) {
    suggestions.push({ field: 'name', message: 'Consider adding a name for better identification' });
  }
  if (!config.image && !config.build) {
    errors.push({ field: 'image', message: 'Either "image" or "build" is required' });
  }

  // Check for deprecated fields
  DEVCONTAINER_SCHEMA.deprecated.forEach(field => {
    if (config[field] !== undefined) {
      warnings.push({ field, message: `"${field}" is deprecated` });
    }
  });

  // Check features format
  if (config.features && typeof config.features !== 'object') {
    errors.push({ field: 'features', message: 'Features should be an object' });
  }

  // Check ports format
  if (config.forwardPorts) {
    if (!Array.isArray(config.forwardPorts)) {
      errors.push({ field: 'forwardPorts', message: 'forwardPorts should be an array' });
    } else {
      config.forwardPorts.forEach((port, i) => {
        if (typeof port !== 'number' && typeof port !== 'string') {
          errors.push({ field: 'forwardPorts', message: `Invalid port at index ${i}` });
        }
      });
    }
  }

  // Check customizations structure
  if (config.customizations?.vscode) {
    if (config.customizations.vscode.extensions && !Array.isArray(config.customizations.vscode.extensions)) {
      errors.push({ field: 'customizations.vscode.extensions', message: 'Extensions should be an array' });
    }
    if (config.customizations.vscode.settings && typeof config.customizations.vscode.settings !== 'object') {
      errors.push({ field: 'customizations.vscode.settings', message: 'Settings should be an object' });
    }
  }

  // Suggestions for common improvements
  if (!config.features || Object.keys(config.features).length === 0) {
    suggestions.push({ field: 'features', message: 'Consider adding features for common tools' });
  }
  if (!config.customizations?.vscode?.extensions || config.customizations.vscode.extensions.length === 0) {
    suggestions.push({ field: 'extensions', message: 'Consider adding VS Code extensions' });
  }

  return { errors, warnings, suggestions, valid: errors.length === 0 };
}

function startServer(port, searchPaths) {
  const publicDir = path.join(__dirname, '..', 'public');

  // State management
  const state = {
    files: [],
    currentIndex: 0,
    configs: {},
    history: [], // For undo functionality
    maxHistory: 50,
  };

  // History management for undo
  function saveHistory() {
    const currentPath = getCurrentPath();
    if (currentPath && state.configs[currentPath]) {
      state.history.push({
        path: currentPath,
        config: JSON.parse(JSON.stringify(state.configs[currentPath])),
        timestamp: Date.now()
      });
      if (state.history.length > state.maxHistory) {
        state.history.shift();
      }
    }
  }

  function scanForFiles() {
    state.files = [];
    for (const searchPath of searchPaths) {
      const found = findDevcontainerFiles(searchPath);
      state.files.push(...found);
    }
    state.files = [...new Set(state.files)];
    for (const filePath of state.files) {
      loadConfigFromFile(filePath);
    }
    return state.files;
  }

  function findDevcontainerFiles(startPath) {
    const results = [];
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

  function loadConfigFromFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Remove comments (JSONC support)
      const cleanContent = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      state.configs[filePath] = JSON.parse(cleanContent);
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

  // Check for Dockerfile
  function getDockerfileInfo() {
    const currentPath = getCurrentPath();
    if (!currentPath) return null;

    const dir = path.dirname(currentPath);
    const dockerfilePath = path.join(dir, 'Dockerfile');
    const dockerComposePath = path.join(dir, 'docker-compose.yml');
    const dockerComposeYamlPath = path.join(dir, 'docker-compose.yaml');

    return {
      hasDockerfile: fs.existsSync(dockerfilePath),
      dockerfilePath: fs.existsSync(dockerfilePath) ? dockerfilePath : null,
      dockerfileContent: fs.existsSync(dockerfilePath) ? fs.readFileSync(dockerfilePath, 'utf-8') : null,
      hasDockerCompose: fs.existsSync(dockerComposePath) || fs.existsSync(dockerComposeYamlPath),
      dockerComposePath: fs.existsSync(dockerComposePath) ? dockerComposePath : (fs.existsSync(dockerComposeYamlPath) ? dockerComposeYamlPath : null),
    };
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

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Helper to read POST body
    const readBody = () => new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({});
        }
      });
    });

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

    // API: Switch file
    if (pathname === '/api/files/select' && req.method === 'POST') {
      const { index } = await readBody();
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

    // API: Add file path
    if (pathname === '/api/files/add' && req.method === 'POST') {
      const { path: newPath } = await readBody();
      if (newPath && fs.existsSync(newPath)) {
        if (!state.files.includes(newPath)) {
          state.files.push(newPath);
          loadConfigFromFile(newPath);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, files: state.files }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
      }
      return;
    }

    // API: Get config
    if (pathname === '/api/config' && req.method === 'GET') {
      const dockerInfo = getDockerfileInfo();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...getCurrentConfig(),
        _meta: {
          path: getCurrentPath(),
          index: state.currentIndex,
          totalFiles: state.files.length,
          ...dockerInfo,
        }
      }, null, 2));
      return;
    }

    // API: Update config
    if (pathname === '/api/config' && req.method === 'POST') {
      const data = await readBody();
      delete data._meta;
      saveHistory();
      const currentPath = getCurrentPath();
      if (currentPath) {
        state.configs[currentPath] = data;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // API: Save config to file
    if (pathname === '/api/save' && req.method === 'POST') {
      const data = await readBody();
      delete data._meta;
      try {
        let savePath = getCurrentPath();
        if (!savePath) {
          savePath = path.join(searchPaths[0] || process.cwd(), '.devcontainer', 'devcontainer.json');
        }
        const dir = path.dirname(savePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(savePath, JSON.stringify(data, null, 2));
        state.configs[savePath] = data;
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
      return;
    }

    // API: Create new devcontainer.json
    if (pathname === '/api/files/create' && req.method === 'POST') {
      const { directory, name } = await readBody();
      try {
        const newPath = path.join(directory, '.devcontainer', 'devcontainer.json');
        const dir = path.dirname(newPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const newConfig = { ...getDefaultDevcontainer(), name: name || 'Dev Container' };
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
      return;
    }

    // API: Search features
    if (pathname === '/api/features/search' && req.method === 'GET') {
      const query = url.searchParams.get('q') || '';
      const results = POPULAR_FEATURES.filter(f =>
        f.name.toLowerCase().includes(query.toLowerCase()) ||
        f.description.toLowerCase().includes(query.toLowerCase()) ||
        f.id.toLowerCase().includes(query.toLowerCase())
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ features: results }));
      return;
    }

    // API: Get popular features
    if (pathname === '/api/features/popular' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ features: POPULAR_FEATURES }));
      return;
    }

    // API: Search extensions
    if (pathname === '/api/extensions/search' && req.method === 'GET') {
      const query = url.searchParams.get('q') || '';
      if (query.length < 2) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ extensions: [] }));
        return;
      }
      const results = await searchExtensions(query);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ extensions: results }));
      return;
    }

    // API: Get templates
    if (pathname === '/api/templates' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ templates: TEMPLATES }));
      return;
    }

    // API: Apply template
    if (pathname === '/api/templates/apply' && req.method === 'POST') {
      const { templateId } = await readBody();
      const template = TEMPLATES.find(t => t.id === templateId);
      if (template) {
        saveHistory();
        const currentPath = getCurrentPath();
        if (currentPath) {
          state.configs[currentPath] = JSON.parse(JSON.stringify(template.config));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, config: template.config }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Template not found' }));
      }
      return;
    }

    // API: Validate config
    if (pathname === '/api/validate' && req.method === 'POST') {
      const config = await readBody();
      delete config._meta;
      const result = validateConfig(config);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // API: Get schema/help
    if (pathname === '/api/schema' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(DEVCONTAINER_SCHEMA));
      return;
    }

    // API: Undo
    if (pathname === '/api/undo' && req.method === 'POST') {
      const currentPath = getCurrentPath();
      const lastHistory = state.history.filter(h => h.path === currentPath).pop();
      if (lastHistory) {
        state.configs[currentPath] = lastHistory.config;
        state.history = state.history.filter(h => h !== lastHistory);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, config: lastHistory.config }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No history available' }));
      }
      return;
    }

    // API: Get history count
    if (pathname === '/api/history' && req.method === 'GET') {
      const currentPath = getCurrentPath();
      const count = state.history.filter(h => h.path === currentPath).length;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ count }));
      return;
    }

    // API: Save Dockerfile
    if (pathname === '/api/dockerfile' && req.method === 'POST') {
      const { content } = await readBody();
      const currentPath = getCurrentPath();
      if (currentPath) {
        const dockerfilePath = path.join(path.dirname(currentPath), 'Dockerfile');
        try {
          fs.writeFileSync(dockerfilePath, content);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, path: dockerfilePath }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No current file' }));
      }
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
