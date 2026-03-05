const { test, expect } = require('@playwright/test');

test.describe('DevContainer Builder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Page Load', () => {
    test('should display the header', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('DevContainer Builder');
    });

    test('should display toolbar buttons', async ({ page }) => {
      await expect(page.locator('text=Raw JSON')).toBeVisible();
      await expect(page.locator('text=Save to File')).toBeVisible();
      await expect(page.locator('text=Download JSON')).toBeVisible();
    });

    test('should load default configuration', async ({ page }) => {
      await expect(page.locator('text=Dev Container')).toBeVisible();
      await expect(page.locator('text=mcr.microsoft.com/devcontainers/base:ubuntu')).toBeVisible();
    });
  });

  test.describe('Base Image Section', () => {
    test('should edit container name', async ({ page }) => {
      const nameField = page.locator('[data-path="name"]');
      await nameField.click();
      await nameField.fill('My Custom Container');
      await nameField.blur();

      await expect(page.locator('.toast')).toContainText('Updated');
    });

    test('should edit image name', async ({ page }) => {
      const imageField = page.locator('[data-path="image"]');
      await imageField.click();
      await imageField.fill('node:20');
      await imageField.blur();

      await expect(page.locator('.toast')).toContainText('Updated');
    });
  });

  test.describe('Features Section', () => {
    test('should add a new feature', async ({ page }) => {
      await page.click('text=+ Add Feature');

      await expect(page.locator('.modal')).toBeVisible();
      await page.fill('#mf-source', 'ghcr.io/devcontainers/features/node:1');
      await page.fill('#mf-name', 'node');
      await page.click('button:has-text("Add")');

      await expect(page.locator('.feature-card')).toBeVisible();
      await expect(page.locator('.feature-name')).toContainText('node');
    });

    test('should add feature option', async ({ page }) => {
      // First add a feature
      await page.click('text=+ Add Feature');
      await page.fill('#mf-source', 'ghcr.io/devcontainers/features/node:1');
      await page.fill('#mf-name', 'node');
      await page.click('button:has-text("Add")');

      // Then add an option
      await page.click('.add-option-btn');
      await page.fill('#mf-optkey', 'version');
      await page.fill('#mf-optval', '20');
      await page.click('button:has-text("Add")');

      await expect(page.locator('.option-tag')).toContainText('version');
      await expect(page.locator('.option-tag .val')).toContainText('20');
    });

    test('should remove a feature', async ({ page }) => {
      // Add a feature first
      await page.click('text=+ Add Feature');
      await page.fill('#mf-source', 'ghcr.io/devcontainers/features/node:1');
      await page.fill('#mf-name', 'node');
      await page.click('button:has-text("Add")');

      await expect(page.locator('.feature-card')).toBeVisible();

      // Remove it
      await page.hover('.feature-card');
      await page.click('.feature-card .remove-btn');

      await expect(page.locator('.feature-card')).not.toBeVisible();
    });
  });

  test.describe('Extensions Section', () => {
    test('should add a VS Code extension', async ({ page }) => {
      await page.click('text=+ Add Extension');

      await page.fill('#mf-extid', 'ms-python.python');
      await page.click('button:has-text("Add")');

      await expect(page.locator('.ext-item')).toBeVisible();
      await expect(page.locator('.ext-id')).toContainText('ms-python.python');
    });

    test('should remove an extension', async ({ page }) => {
      // Add an extension first
      await page.click('text=+ Add Extension');
      await page.fill('#mf-extid', 'ms-python.python');
      await page.click('button:has-text("Add")');

      await expect(page.locator('.ext-item')).toBeVisible();

      // Remove it
      await page.hover('.ext-item');
      await page.click('.ext-item .remove-btn');

      await expect(page.locator('.ext-item')).not.toBeVisible();
    });
  });

  test.describe('Settings Section', () => {
    test('should add a VS Code setting', async ({ page }) => {
      await page.click('text=+ Add Setting');

      await page.fill('#mf-setkey', 'editor.fontSize');
      await page.fill('#mf-setval', '14');
      await page.click('button:has-text("Add")');

      await expect(page.locator('.setting-key')).toContainText('editor.fontSize');
      await expect(page.locator('.setting-val')).toContainText('14');
    });

    test('should add a boolean setting', async ({ page }) => {
      await page.click('text=+ Add Setting');

      await page.fill('#mf-setkey', 'editor.formatOnSave');
      await page.fill('#mf-setval', 'true');
      await page.click('button:has-text("Add")');

      await expect(page.locator('.setting-key')).toContainText('editor.formatOnSave');
    });
  });

  test.describe('Environment Variables', () => {
    test('should add containerEnv', async ({ page }) => {
      await page.click('text=+ Add containerEnv');

      await page.fill('#mf-envkey', 'NODE_ENV');
      await page.fill('#mf-envval', 'development');
      await page.click('button:has-text("Add")');

      await expect(page.locator('.env-key')).toContainText('NODE_ENV');
      await expect(page.locator('.env-val')).toContainText('development');
    });

    test('should add remoteEnv', async ({ page }) => {
      await page.click('text=+ Add remoteEnv');

      await page.fill('#mf-envkey', 'PATH');
      await page.fill('#mf-envval', '/usr/local/bin:$PATH');
      await page.click('button:has-text("Add")');

      const remoteEnvSection = page.locator('.section:has-text("Remote Environment")');
      await expect(remoteEnvSection.locator('.env-key')).toContainText('PATH');
    });
  });

  test.describe('Port Forwarding', () => {
    test('should add a forwarded port', async ({ page }) => {
      const portsSection = page.locator('.section:has-text("Port Forwarding")');
      await portsSection.locator('.chip-add').click();

      await page.fill('#mf-chip', '3000');
      await page.click('button:has-text("Add")');

      await expect(portsSection.locator('.chip')).toContainText('3000');
    });

    test('should remove a forwarded port', async ({ page }) => {
      const portsSection = page.locator('.section:has-text("Port Forwarding")');
      await portsSection.locator('.chip-add').click();
      await page.fill('#mf-chip', '3000');
      await page.click('button:has-text("Add")');

      await expect(portsSection.locator('.chip')).toBeVisible();

      await portsSection.locator('.chip-remove').click();

      await expect(portsSection.locator('.chip')).not.toBeVisible();
    });
  });

  test.describe('Mounts Section', () => {
    test('should add a bind mount', async ({ page }) => {
      await page.click('text=+ Add Mount');

      await page.fill('#mf-msrc', '${localEnv:HOME}/.ssh');
      await page.fill('#mf-mtgt', '/home/vscode/.ssh');
      await page.click('button:has-text("Add")');

      await expect(page.locator('.mount-item')).toBeVisible();
      await expect(page.locator('.mount-item .host')).toContainText('.ssh');
    });
  });

  test.describe('Lifecycle Commands', () => {
    test('should edit postCreateCommand', async ({ page }) => {
      const textarea = page.locator('[data-cmd="postCreateCommand"]');
      await textarea.fill('npm install && npm run build');
      await textarea.blur();

      await expect(page.locator('.toast')).toContainText('Updated');
    });
  });

  test.describe('JSON Export', () => {
    test('should toggle raw JSON view', async ({ page }) => {
      await page.click('text=Raw JSON');

      await expect(page.locator('#rawJson')).toBeVisible();
      await expect(page.locator('#rawJson')).toContainText('"name"');

      await page.click('text=Hide JSON');
      await expect(page.locator('#rawJson')).not.toBeVisible();
    });

    test('should download JSON file', async ({ page }) => {
      const downloadPromise = page.waitForEvent('download');
      await page.click('text=Download JSON');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe('devcontainer.json');
    });
  });

  test.describe('API Endpoints', () => {
    test('GET /api/config should return configuration', async ({ request }) => {
      const response = await request.get('/api/config');
      expect(response.ok()).toBeTruthy();

      const config = await response.json();
      expect(config).toHaveProperty('name');
      expect(config).toHaveProperty('image');
    });

    test('POST /api/config should update configuration', async ({ request }) => {
      const newConfig = {
        name: 'Test Container',
        image: 'node:18',
      };

      const response = await request.post('/api/config', {
        data: newConfig,
      });

      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.success).toBe(true);
    });
  });

  test.describe('Modal Interactions', () => {
    test('should close modal on cancel', async ({ page }) => {
      await page.click('text=+ Add Feature');
      await expect(page.locator('.modal')).toBeVisible();

      await page.click('button:has-text("Cancel")');
      await expect(page.locator('.modal-overlay')).not.toHaveClass(/show/);
    });

    test('should close modal on overlay click', async ({ page }) => {
      await page.click('text=+ Add Feature');
      await expect(page.locator('.modal')).toBeVisible();

      await page.click('.modal-overlay', { position: { x: 10, y: 10 } });
      await expect(page.locator('.modal-overlay')).not.toHaveClass(/show/);
    });

    test('should show error for empty required fields', async ({ page }) => {
      await page.click('text=+ Add Feature');
      await page.click('button:has-text("Add")');

      await expect(page.locator('.toast.error')).toBeVisible();
    });
  });

  test.describe('User Configuration', () => {
    test('should update remoteUser', async ({ page }) => {
      const input = page.locator('[data-input="remoteUser"]');
      await input.fill('node');
      await input.blur();

      await expect(page.locator('.toast')).toContainText('Updated');
    });
  });
});
