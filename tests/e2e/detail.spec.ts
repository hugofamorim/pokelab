import { test, expect } from '@playwright/test';
// Images also stay offline: missing artwork has a first-class product fallback.
test.beforeEach(async ({ page }) => {
  await page.route('**/_next/image**', (route) => {
    const source = new URL(route.request().url()).searchParams.get('url');
    return source?.startsWith('https:') ? route.abort() : route.continue();
  });
});
for (const width of [375, 768, 1280, 1600]) {
  test(`detail is readable without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/pokemon/25');
    await expect(
      page.getByRole('heading', { name: 'pikachu', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Elétrico', { exact: true })).toBeVisible();
    await expect(page.getByText('0,4', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('meter')).toHaveCount(6);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole('link', { name: 'Explorar atributos' }).click();
    await expect(
      page.getByRole('heading', { name: 'Atributos base' }),
    ).toBeInViewport();
    await page.screenshot({
      path: `artifacts/detail-${width}.png`,
      fullPage: true,
    });
  });
}
test('unavailable data, retry, loading and image absence', async ({ page }) => {
  await page.goto('/pokemon/missing');
  await expect(
    page.getByRole('heading', { name: 'Pokémon não encontrado' }),
  ).toBeVisible();
  await page.goto('/pokemon/unavailable');
  await expect(
    page.getByRole('heading', { name: 'Não conseguimos carregar os dados' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Tentar novamente' }),
  ).toHaveAttribute('href', '/pokemon/unavailable');
  await page.goto('/pokemon/no-art');
  await expect(page.getByText('Ilustração indisponível')).toBeVisible();
  await expect(
    page.getByText('Nenhuma habilidade disponível na fonte.'),
  ).toBeVisible();
  await page.goto('/pokemon/slow', { waitUntil: 'commit' });
  await expect(
    page.getByRole('status', { name: 'Carregando Pokémon' }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'pikachu', exact: true }),
  ).toBeVisible();
});
test('keyboard skip link and 200 percent text size remain usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/pokemon/25');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Pular para o conteúdo' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
