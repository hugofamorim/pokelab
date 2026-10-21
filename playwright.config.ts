import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 30000,
  globalTimeout: 180000,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node apps/api/test/fixture-server.mjs',
      url: 'http://127.0.0.1:3101/v1/pokemon/25',
      reuseExistingServer: false,
    },
    {
      command:
        'node apps/web/node_modules/next/dist/bin/next start apps/web --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100',
      env: { API_URL: 'http://127.0.0.1:3101' },
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
