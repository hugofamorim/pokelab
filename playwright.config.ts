import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node apps/api/test/fixture-server.mjs',
      url: 'http://localhost:3101/v1/pokemon/25',
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @pokelab/web exec next start --port 3100',
      url: 'http://localhost:3100',
      env: { API_URL: 'http://localhost:3101' },
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
