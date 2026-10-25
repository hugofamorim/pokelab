import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/_next/image**', (route) =>
    new URL(route.request().url()).searchParams.get('url')?.startsWith('https:')
      ? route.abort()
      : route.continue(),
  );
});
for (const width of [375, 768, 1280, 1600]) {
  test(`detail shows exactly one section and retains movement context at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(
      '/pokemon/25?fromPage=2&fromType=electric&moveVersion=1&movePage=2#movimentos',
    );
    await expect(
      page.getByRole('tab', { name: 'Movimentos', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Movimentos');
    await expect(page.getByRole('meter')).toHaveCount(0);
    for (const name of [
      'Atributos',
      'Habilidades',
      'Dados do Pokémon',
      'Sobre a espécie',
      'Evoluções',
      'Movimentos',
    ]) {
      await page.getByRole('tab', { name, exact: true }).click();
      await expect(page.getByRole('tabpanel')).toHaveCount(1);
      await expect(page.getByRole('tabpanel')).toHaveAccessibleName(name);
      await expect(
        page.getByRole('tab', { name, exact: true }),
      ).toHaveAttribute('aria-selected', 'true');
      expect(new URL(page.url()).search).toBe(
        '?fromPage=2&fromType=electric&moveVersion=1&movePage=2',
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await expect(
      page.getByRole('navigation', { name: 'Páginas de movimentos' }),
    ).toContainText('Página 2');
    await page.getByRole('tab', { name: 'Habilidades', exact: true }).click();
    await page.goBack();
    await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Movimentos');
    await page.reload();
    await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Movimentos');
    await expect(
      page.getByRole('link', { name: 'Voltar à Pokédex' }),
    ).toHaveAttribute('href', '/pokedex?page=2&type=electric');
    await page.getByRole('tab', { name: 'Atributos', exact: true }).click();
    await page.screenshot({
      path: `artifacts/detail-tabs-${width}.png`,
      fullPage: true,
    });
  });
}
test('arrow keys Home End and Tab use roving focus and retain a single accessible panel', async ({
  page,
}) => {
  await page.goto('/pokemon/25');
  await page.getByRole('tab', { name: 'Atributos', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('tab', { name: 'Habilidades', exact: true }),
  ).toBeFocused();
  await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Habilidades');
  await page.keyboard.press('End');
  await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Movimentos');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Atributos');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Movimentos');
  await page.keyboard.press('Home');
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('tab', { name: 'Atributos', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tabpanel')).toBeFocused();
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('native hash links select one server-rendered panel before app hydration', async ({
  page,
}) => {
  await page.route('**/_next/static/**/*.js', (route) => route.abort());
  await page.goto('/pokemon/25#sobre-especie');
  await expect(page.getByRole('tabpanel')).toHaveAccessibleName(
    'Sobre a espécie',
  );
  await expect(
    page.getByText('When several of', { exact: false }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Habilidades', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Habilidades');
  await expect(page.getByRole('meter')).toHaveCount(0);
  await page.goto('/pokemon/25#sobre');
  await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Atributos');
  await expect(page.locator('footer#sobre')).toBeInViewport();
});
