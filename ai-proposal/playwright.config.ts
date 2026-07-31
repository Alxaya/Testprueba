import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

/**
 * Permite apuntar a un Chromium ya instalado en el sistema.
 *
 * Útil en imágenes de CI o contenedores que traen el navegador preinstalado con
 * una revisión distinta de la que Playwright descargaría. Sin la variable, se
 * usa el navegador que gestiona Playwright, que es el comportamiento normal.
 */
const launch = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
  : {};

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
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...launch } },

    // Móvil desde el primer día: el usuario objetivo presupuesta desde la
    // furgoneta, no desde un escritorio. Si solo se prueba en desktop, el móvil
    // se rompe sin que nadie se entere.
    //
    // Viewport de iPhone SE (375×667) sobre Chromium en lugar del preset de
    // WebKit: es la pantalla más pequeña que hay que soportar, y así la suite
    // funciona en entornos donde solo está instalado Chromium. La verificación
    // en Safari real es parte de F8.
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        ...launch,
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  webServer: {
    command: 'npm run start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
