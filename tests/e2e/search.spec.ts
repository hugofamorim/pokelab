import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/_next/image**', (route) => {
    const source = new URL(route.request().url()).searchParams.get('url');
    return source?.startsWith('https:') ? route.abort() : route.continue();
  });
});
for (const width of [375, 768, 1280, 1600]) {
  test(`exact search, detail return and clear work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/pokedex?page=2');
    const input = page.getByRole('searchbox', {
      name: 'Qual Pokémon você quer conhecer?',
    });
    await input.fill(' PIKACHU ');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/pokedex\?search=pikachu$/);
    await expect(
      page.getByRole('heading', { name: 'Resultado para “pikachu”' }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('list', { name: 'Resultado da busca' })
        .getByRole('listitem'),
    ).toHaveCount(1);
    await expect(page.getByLabel('Paginação do catálogo')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/search-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole('list', { name: 'Resultado da busca' })
      .getByRole('link')
      .click();
    await expect(page).toHaveURL(/\/pokemon\/25\?fromSearch=pikachu$/);
    await page.getByRole('link', { name: 'Voltar à Pokédex' }).click();
    await expect(page).toHaveURL(/\/pokedex\?search=pikachu$/);
    await page.reload();
    await expect(input).toHaveValue('pikachu');
    await input.press('Escape');
    await expect(page).toHaveURL(/\/pokedex$/);
    await expect(input).toHaveValue('');
    await input.fill('25');
    await page
      .getByRole('button', { name: 'Buscar Pokémon', exact: true })
      .click();
    await expect(page).toHaveURL(/\/pokedex\?search=25$/);
    await expect(
      page.getByRole('heading', { name: 'pikachu', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Limpar busca' }).click();
    await expect(page).toHaveURL(/\/pokedex$/);
  });
}
test('validates drafts without fetching per keystroke and accepts only exact matches', async ({
  page,
}) => {
  await page.goto('/pokedex?search=25');
  await expect(
    page.getByRole('heading', { name: 'pikachu', exact: true }),
  ).toBeVisible();
  const input = page.getByRole('searchbox');
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/pokedex?search='))
      requests.push(request.url());
  });
  await input.fill('pika chu');
  await expect(
    page.getByRole('search', { name: 'Busca de Pokémon' }).getByRole('alert'),
  ).toContainText('Use o nome completo');
  await page
    .getByRole('button', { name: 'Buscar Pokémon', exact: true })
    .click();
  expect(requests).toHaveLength(0);
  await expect(page).toHaveURL(/search=25$/);
  await input.fill('pika');
  await input.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Nenhum Pokémon encontrado' }),
  ).toBeVisible();
  await expect(
    page.getByText('A busca por partes do nome ainda não está disponível.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Resultado da busca' }),
  ).toHaveCount(0);
});
test('handles unsafe/repeated queries, outages, stale data and loading', async ({
  page,
}) => {
  for (const query of [
    'search=25&search=26',
    'search=25&page=1',
    'search=https%3A%2F%2Fevil.test',
    'search=' + 'a'.repeat(65),
  ]) {
    await page.goto('/pokedex?' + query);
    await expect(
      page.getByRole('heading', { name: 'Busca inválida' }),
    ).toBeVisible();
  }
  await page.goto('/pokedex?search=unavailable');
  await expect(
    page.getByRole('heading', { name: 'Não conseguimos realizar a busca' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Tentar busca novamente' }),
  ).toHaveAttribute('href', '/pokedex?search=unavailable');
  await page.goto('/pokedex?search=venusaur');
  await expect(page.getByText('Dados salvos em')).toBeVisible();
  await page.goto('/pokedex?search=ivysaur', { waitUntil: 'commit' });
  await expect(
    page.getByRole('status', { name: 'Buscando Pokémon' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'ivysaur', exact: true }),
  ).toBeVisible();
});
test('keyboard focus, browser history and text zoom preserve search usability', async ({
  page,
}) => {
  await page.goto('/pokedex?search=25');
  await expect(
    page.getByRole('heading', { name: 'pikachu', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Pular para o conteúdo' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  const input = page.getByRole('searchbox');
  await input.focus();
  await input.fill('bulbasaur');
  await input.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'bulbasaur', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(input).toHaveValue('25');
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto('/pokemon/25?fromSearch=https%3A%2F%2Fevil.test');
  await expect(
    page.getByRole('link', { name: 'Voltar à Pokédex' }),
  ).toHaveAttribute('href', '/pokedex?page=1');
});
test('initial pageshow preserves a typed draft while persisted restoration follows the URL', async ({
  page,
}) => {
  await page.goto('/pokedex?search=25');
  const input = page.getByRole('searchbox');
  await expect(
    page.getByRole('button', { name: 'Limpar busca' }),
  ).toBeVisible();
  await input.fill('pikachu');
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: false }),
    ),
  );
  await expect(input).toHaveValue('pikachu');
  await input.press('Enter');
  await expect(page).toHaveURL(/search=pikachu$/);
  await input.fill('unsubmitted-draft');
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    ),
  );
  await expect(input).toHaveValue('pikachu');
});

test('HTML search submission works before JavaScript hydration', async ({
  page,
}) => {
  let blockScripts = true;
  let blocked = false;
  await page.route('**/_next/static/**/*.js', (route) => {
    if (blockScripts) {
      blocked = true;
      return route.abort();
    }
    return route.continue();
  });
  await page.goto('/pokedex');
  expect(blocked).toBe(true);
  await page
    .getByRole('searchbox', { name: 'Qual Pokémon você quer conhecer?' })
    .fill(' PIKACHU ');
  // Only the fallback HTML form can submit this first page. The destination can hydrate.
  blockScripts = false;
  await page
    .getByRole('button', { name: 'Buscar Pokémon', exact: true })
    .click();
  await expect(page).toHaveURL(/\/pokedex\?search=pikachu$/);
  await expect(
    page.getByRole('heading', { name: 'pikachu', exact: true }),
  ).toBeVisible();
});
