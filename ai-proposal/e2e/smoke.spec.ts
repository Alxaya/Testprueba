import { expect, test } from '@playwright/test';

/**
 * Verificación mínima de F0: la aplicación se construye, arranca y sirve una
 * página accesible con las cabeceras de seguridad puestas.
 *
 * Los recorridos completos (registro → generar → PDF → compartir) llegan con
 * las fases que los implementan.
 */
test('la página inicial carga y es navegable', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/AI Proposal/);
});

test('el enlace de salto al contenido aparece al tabular', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');

  // Es el primer elemento enfocable de la página: sin él, quien navega con
  // teclado tiene que recorrer toda la navegación en cada carga.
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
});

test('las cabeceras de seguridad están presentes', async ({ page }) => {
  const response = await page.goto('/');
  const headers = response?.headers() ?? {};

  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  // Delatar la versión del framework solo ayuda a quien busca exploits conocidos.
  expect(headers['x-powered-by']).toBeUndefined();
});
