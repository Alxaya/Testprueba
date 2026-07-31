import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Un `.only` olvidado no debe hacer que CI dé por buena media suite.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Serie en CI: los runners comparten CPU y la paralelización produce
  // timeouts intermitentes que se confunden con fallos reales.
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Móvil desde el primer día: el usuario objetivo presupuesta desde la
    // furgoneta, no desde un escritorio. Si solo se prueba en desktop, el móvil
    // se rompe sin que nadie se entere.
    { name: 'mobile', use: { ...devices['iPhone SE'] } },
  ],

  webServer: {
    command: 'npm run start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
