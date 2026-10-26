import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/_next/image**', (route) =>
    new URL(route.request().url()).searchParams.get('url')?.startsWith('https:')
      ? route.abort()
      : route.continue(),
  );
});
for (const width of [375, 768, 1280, 1600]) {
  test(`generation selection, pagination and mapped detail return at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/pokedex?page=2');
    const generations = page.getByRole('navigation', {
      name: 'Gerações de Pokémon',
    });
    await expect(generations.getByRole('link')).toHaveCount(10);
    const first = generations.getByRole('link', {
      name: 'Geração I',
      exact: true,
    });
    await first.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/page=1&generation=1$/);
    await expect(first).toHaveAttribute('aria-current', 'true');
    await expect(
      page.getByRole('heading', { name: 'Espécies da geração I', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('12 de 12 espécies com variedade padrão disponível.'),
    ).toBeVisible();
    await expect(page.getByText('Índice de espécies salvo em')).toBeVisible();
    await page.screenshot({
      path: `artifacts/generation-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole('link', { name: 'Próxima', exact: true }).click();
    await expect(page).toHaveURL(/page=2&generation=1$/);
    await expect(
      page.getByText('1 de 1 espécie com variedade padrão disponível.'),
    ).toBeVisible();
    const card = page
      .getByRole('list', { name: 'Espécies desta página' })
      .getByRole('link');
    await expect(card).toHaveAttribute(
      'href',
      '/pokemon/25?fromPage=2&fromGeneration=1',
    );
    await card.click();
    await page.getByRole('link', { name: 'Voltar à Pokédex' }).click();
    await expect(page).toHaveURL(/page=2&generation=1$/);
    await page.reload();
    await expect(first).toHaveAttribute('aria-current', 'true');
    await generations
      .getByRole('link', { name: 'Geração IV', exact: true })
      .click();
    await expect(page).toHaveURL(/page=1&generation=4$/);
    await expect(
      page.getByText('1 de 1 espécie com variedade padrão disponível.'),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'wormadam-plant', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Espécie: wormadam', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Mapeamento salvo em')).toBeVisible();
    await expect(page.getByText('Dados do Pokémon salvos em')).toBeVisible();
    await page.screenshot({
      path: `artifacts/generation-variety-${width}.png`,
      fullPage: true,
    });
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test('generation, type and search replace modes and history restores the committed selection', async ({
  page,
}) => {
  await page.goto('/pokedex?generation=4');
  const input = page.getByRole('searchbox');
  await input.fill('pikachu');
  await input.press('Enter');
  await expect(page).toHaveURL(/search=pikachu$/);
  const generations = page.getByRole('navigation', {
    name: 'Gerações de Pokémon',
  });
  await expect(generations.locator('[aria-current]')).toHaveCount(0);
  await generations
    .getByRole('link', { name: 'Geração I', exact: true })
    .click();
  await expect(input).toHaveValue('');
  await expect(page).toHaveURL(/page=1&generation=1$/);
  await page
    .getByRole('navigation', { name: 'Tipos de Pokémon' })
    .getByRole('link', { name: 'Planta', exact: true })
    .click();
  await expect(page).toHaveURL(/type=grass&generation=1$/);
  await page.goBack();
  await expect(
    generations.getByRole('link', { name: 'Geração I', exact: true }),
  ).toHaveAttribute('aria-current', 'true');
  await generations.getByRole('link', { name: 'Todas', exact: true }).click();
  await expect(page).toHaveURL(/\/pokedex$/);
});

test('references remain unlinked until validated, batches are bounded and retry targets failed species only', async ({
  page,
}) => {
  const batches: string[] = [];
  let first = true;
  await page.route('**/api/catalog/generation-cards?*', async (route) => {
    batches.push(
      new URL(route.request().url()).searchParams.get('speciesIds')!,
    );
    if (first) {
      first = false;
      await new Promise((resolve) => setTimeout(resolve, 700));
      const response = await route.fetch(),
        body = await response.json();
      body.items[0] = {
        speciesId: 1,
        status: 'unavailable',
        code: 'UPSTREAM_UNAVAILABLE',
      };
      await route.fulfill({ response, json: body });
    } else await route.continue();
  });
  await page.goto('/pokedex?generation=1');
  const list = page.getByRole('list', { name: 'Espécies desta página' });
  await expect(
    list.getByRole('heading', { name: 'bulbasaur', exact: true }),
  ).toBeVisible();
  await expect(
    list.getByRole('link').filter({
      has: page.getByRole('heading', { name: 'bulbasaur', exact: true }),
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText('11 de 12 espécies com variedade padrão disponível.'),
  ).toBeVisible();
  expect(batches).toEqual(['1,2,3,4', '5,6,7,8', '9,10,11,12']);
  await page
    .getByRole('button', { name: 'Tentar variedades novamente' })
    .click();
  await expect(
    page.getByText('12 de 12 espécies com variedade padrão disponível.'),
  ).toBeVisible();
  expect(batches.at(-1)).toBe('1');
});

test('handles empty, unavailable, loading and ambiguous generation queries', async ({
  page,
}) => {
  await page.goto('/pokedex?page=3&generation=1');
  await expect(
    page.getByRole('heading', { name: 'Nenhuma espécie nesta página' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Ir para a primeira página' }),
  ).toHaveAttribute('href', '/pokedex?page=1&generation=1');
  await page.goto('/pokedex?page=2&generation=3');
  await expect(
    page.getByRole('heading', { name: 'Não conseguimos abrir o catálogo' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Tentar novamente' }),
  ).toHaveAttribute('href', '/pokedex?page=2&generation=3');
  // Warm the shared generation index through the combined mode first.
  const warm = await page.request.get(
    'http://127.0.0.1:3101/v1/pokemon/filter-scan?type=grass&generation=2&limit=4',
  );
  expect(warm.ok()).toBe(true);
  await page.goto('/pokedex?generation=2', { waitUntil: 'commit' });
  await expect(
    page.getByRole('status', { name: 'Carregando catálogo' }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Nenhuma espécie nesta página' }),
  ).toBeVisible();
  for (const query of [
    'generation=10',
    'generation=01',
    'generation=1&generation=2',
    'generation=1&type=grass&page=1',
    'generation=1&search=25',
  ]) {
    await page.goto('/pokedex?' + query);
    await expect(
      page.getByRole('heading', {
        name: query.includes('search') ? 'Busca inválida' : 'Página inválida',
      }),
    ).toBeVisible();
  }
});

test('rejects a cross-source species-name mismatch and discards delayed results on navigation', async ({
  page,
}) => {
  await page.route(
    '**/api/catalog/generation-cards?speciesIds=1,2,3,4',
    async (route) => {
      const response = await route.fetch(),
        body = await response.json();
      body.items[0].mapping.data.species.name = 'fixture-conflicting-name';
      body.items[0].summary.data.species.name = 'fixture-conflicting-name';
      await route.fulfill({ response, json: body });
    },
  );
  await page.goto('/pokedex?generation=1');
  await expect(
    page.getByText('11 de 12 espécies com variedade padrão disponível.'),
  ).toBeVisible();
  await expect(
    page
      .getByRole('list', { name: 'Espécies desta página' })
      .getByRole('link')
      .filter({
        has: page.getByRole('heading', { name: 'bulbasaur', exact: true }),
      }),
  ).toHaveCount(0);
  await page.unroute('**/api/catalog/generation-cards?speciesIds=1,2,3,4');
  await page.route('**/api/catalog/generation-cards?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue().catch(() => {});
  });
  await page.reload();
  await page
    .getByRole('navigation', { name: 'Gerações de Pokémon' })
    .getByRole('link', { name: 'Geração IV', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'wormadam-plant', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'bulbasaur', exact: true }),
  ).toHaveCount(0);
});

test('generation links work without JavaScript and unresolved species never guess detail URLs', async ({
  page,
}) => {
  await page.route('**/_next/static/**/*.js', (route) => route.abort());
  await page.goto('/pokedex');
  await page
    .getByRole('navigation', { name: 'Gerações de Pokémon' })
    .getByRole('link', { name: 'Geração I', exact: true })
    .click();
  await expect(page).toHaveURL(/page=1&generation=1$/);
  const list = page.getByRole('list', { name: 'Espécies desta página' });
  await expect(
    list.getByRole('heading', { name: 'bulbasaur', exact: true }),
  ).toBeVisible();
  await expect(list.getByRole('link')).toHaveCount(0);
});
