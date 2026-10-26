import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// An independent bounded audit; functional E2E retains its existing 180s budget.
export default defineConfig({
  ...base,
  testDir: './tests/accessibility',
  outputDir: './test-results/accessibility',
  globalTimeout: 90000,
  timeout: 40000,
});
