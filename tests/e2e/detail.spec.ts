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
    await expect(page.locator('#sobre-especie')).toHaveCount(1);
    await expect(page.locator('#sobre')).toHaveCount(1);
    const about = page.getByRole('region', { name: 'Sobre a espécie' });
    await expect(
      about.getByText('When several of', { exact: false }),
    ).toHaveAttribute('lang', 'en');
    await expect(
      about.getByText('Texto original em inglês;', { exact: false }),
    ).toBeVisible();
    await expect(about.getByText('red', { exact: true })).toBeVisible();
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
  await page
    .getByRole('link', { name: 'Sobre a espécie', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Sobre a espécie', exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('species metadata is optional and retries preserve the catalog return URL', async ({
  page,
}) => {
  await page.goto('/pokemon/1');
  await expect(
    page.getByText('A fonte não fornece descrição', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('meter')).toHaveCount(6);
  await page.goto('/pokemon/2');
  await expect(
    page.getByText('A descrição desta espécie não foi encontrada na fonte.'),
  ).toBeVisible();
  await page.goto('/pokemon/3?fromPage=2&fromGeneration=1#sobre-especie');
  await expect(
    page.getByText('Não conseguimos carregar a descrição da espécie.'),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Tentar descrição novamente' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Tentar descrição novamente' }),
  ).toBeEnabled();
  await expect(page).toHaveURL(
    /pokemon\/3\?fromPage=2&fromGeneration=1#sobre-especie$/,
  );
  await expect(
    page.getByRole('link', { name: 'Voltar à Pokédex' }),
  ).toHaveAttribute('href', '/pokedex?page=2&generation=1');
  await expect(page.getByRole('meter')).toHaveCount(6);
  await page.goto('/pokemon/5');
  await expect(
    page.getByText('Não conseguimos carregar a descrição da espécie.'),
  ).toBeVisible();
  await expect(
    page.getByText('identity-mismatch', { exact: false }),
  ).toHaveCount(0);
});

test('description streams independently and stale metadata keeps species identity on a variety', async ({
  page,
}) => {
  await page.goto('/pokemon/4', { waitUntil: 'commit' });
  await expect(
    page.getByRole('heading', { name: 'charmander', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('status', { name: 'Carregando descrição' }),
  ).toBeVisible();
  await expect(page.getByRole('meter')).toHaveCount(6);
  await expect(
    page.getByText('A fonte não fornece descrição', { exact: false }),
  ).toBeVisible();
  await page.goto('/pokemon/413');
  await expect(
    page.getByRole('heading', { name: 'wormadam-plant', exact: true }),
  ).toBeVisible();
  const about = page.getByRole('region', { name: 'Sobre a espécie' });
  await expect(
    about.getByText('Registro da espécie wormadam · #413.', { exact: false }),
  ).toBeVisible();
  await expect(
    about.getByText('When BURMY evolved', { exact: false }),
  ).toHaveAttribute('lang', 'en');
  await expect(
    about.getByText('Descrição salva em', { exact: false }),
  ).toBeVisible();
  await expect(about.getByText('diamond', { exact: true })).toBeVisible();
  await page.screenshot({
    path: 'artifacts/description-stale.png',
    fullPage: true,
  });
});

test('source description and language render before client hydration', async ({
  page,
}) => {
  // React's inline streaming scripts still apply server HTML; no app bundle hydrates.
  await page.route('**/_next/static/**/*.js', (route) => route.abort());
  await page.goto('/pokemon/25#sobre-especie');
  const about = page.getByRole('region', { name: 'Sobre a espécie' });
  await expect(
    about.getByText('When several of', { exact: false }),
  ).toHaveAttribute('lang', 'en');
  await expect(
    about.getByText('Texto original em inglês;', { exact: false }),
  ).toBeVisible();
});
