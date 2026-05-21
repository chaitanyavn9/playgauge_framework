import { defineConfig, devices } from '@playwright/test';
import { EnvLoader } from './tests/utils/EnvLoader';

const env = EnvLoader.load();

export default defineConfig({
  // ─── Test discovery ────────────────────────────────────────────────────────
  testDir: './tests',
  testMatch: '**/*.spec.ts',

  // ─── Execution ─────────────────────────────────────────────────────────────
  fullyParallel: false,           // Gauge manages parallelism via --parallel flag
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // ─── Reporters ─────────────────────────────────────────────────────────────
  reporter: [
    ['list'],
    ['allure-playwright', {
      detail: true,
      outputFolder: 'allure-results',
      suiteTitle: false,
    }],
    ['json', { outputFile: 'dist/test-results/results.json' }],
    ['html',  { outputFolder: 'dist/test-results/html', open: 'never' }],
  ],

  // ─── Global test settings ──────────────────────────────────────────────────
  use: {
    baseURL:           env.baseURL,
    headless:          env.headless,
    screenshot:        'only-on-failure',
    video:             'retain-on-failure',
    trace:             'retain-on-failure',
    viewport:          { width: 1440, height: 900 },
    actionTimeout:     15_000,
    navigationTimeout: 30_000,

    // ── Observability thresholds (override per env in .properties files) ────
    // slowApiThresholdMs is read from env; fall back to 1500ms
    extraHTTPHeaders: { 'x-automation-run': 'playgauge' },
  },

  // ─── Projects (browsers) ──────────────────────────────────────────────────
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // ─── Output dirs ─────────────────────────────────────────────────────────
  outputDir: 'dist/test-results/artifacts',
});
