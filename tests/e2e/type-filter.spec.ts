import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/_next/image**', (route) => {
    const source = new URL(route.request().url()).searchParams.get('url');
    return source?.startsWith('https:') ? route.abort() : route.continue();
  });
});

for (const width of [375, 768, 1280, 1600]) {
  test(`type selection, pagination and detail return at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/pokedex?page=2');
    const filters = page.getByRole('navigation', { name: 'Tipos de Pokémon' });
    await expect(filters.getByRole('link')).toHaveCount(19);
    const electric = filters.getByRole('link', {
      name: 'Elétrico',
      exact: true,
    });
    await electric.focus();
    await expect(electric).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/page=1&type=electric$/);
    await expect(electric).toHaveAttribute('aria-current', 'true');
    await expect(
      page.getByRole('heading', { name: 'Pokémon do tipo Elétrico' }),
    ).toBeVisible();
    await expect(
      page.getByText('1 de 12 Pokémon com detalhes disponíveis.'),
    ).toBeVisible();
    await expect(
      page
        .getByRole('list', { name: 'Pokémon desta página' })
        .getByRole('link')
        .first(),
    ).toHaveAttribute('href', '/pokemon/25?fromPage=1&fromType=electric');
    await page.screenshot({
      path: `artifacts/type-filter-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('link', { name: 'Próxima', exact: true }).click();
    await expect(page).toHaveURL(/page=2&type=electric$/);
    await expect(electric).toHaveAttribute('aria-current', 'true');
    const reference = page
      .getByRole('list', { name: 'Pokémon desta página' })
      .getByRole('link')
      .first();
    await expect(reference).toHaveAttribute(
      'href',
      /fromPage=2&fromType=electric$/,
    );
    await reference.click();
    await page.getByRole('link', { name: 'Voltar à Pokédex' }).click();
    await expect(page).toHaveURL(/page=2&type=electric$/);
    await page.reload();
    await expect(electric).toHaveAttribute('aria-current', 'true');
    await filters.getByRole('link', { name: 'Planta', exact: true }).click();
    await expect(page).toHaveURL(/page=1&type=grass$/);
    await expect(
      page.getByText('3 de 3 Pokémon com detalhes disponíveis.'),
    ).toBeVisible();
    await expect(
      page
        .getByRole('list', { name: 'Pokémon desta página' })
        .getByText('Veneno', { exact: true }),
    ).toHaveCount(3);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
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

test('search, history and clear replace the selected mode without stale controls', async ({
  page,
}) => {
  await page.goto('/pokedex?type=grass');
  const filters = page.getByRole('navigation', { name: 'Tipos de Pokémon' });
  const grass = filters.getByRole('link', { name: 'Planta', exact: true });
  await expect(grass).toHaveAttribute('aria-current', 'true');
  const input = page.getByRole('searchbox');
  await input.fill('pikachu');
  await input.press('Enter');
  await expect(page).toHaveURL(/search=pikachu$/);
  await expect(filters.locator('[aria-current]')).toHaveCount(0);
  await filters.getByRole('link', { name: 'Fogo', exact: true }).click();
  await expect(page).toHaveURL(/page=1&type=fire$/);
  await expect(input).toHaveValue('');
  await page.goBack();
  await expect(input).toHaveValue('pikachu');
  await page.goBack();
  await expect(grass).toHaveAttribute('aria-current', 'true');
  await expect(input).toHaveValue('');
  await filters.getByRole('link', { name: 'Todos', exact: true }).click();
  await expect(page).toHaveURL(/\/pokedex$/);
  await expect(
    filters.getByRole('link', { name: 'Todos', exact: true }),
  ).toHaveAttribute('aria-current', 'true');
});

test('filtered failures, empty pages, stale data and invalid queries remain explicit', async ({
  page,
}) => {
  await page.goto('/pokedex?page=2&type=grass');
  await expect(
    page.getByRole('heading', { name: 'Nenhum Pokémon nesta página' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Ir para a primeira página' }),
  ).toHaveAttribute('href', '/pokedex?page=1&type=grass');
  await page.goto('/pokedex?page=2&type=ghost');
  await expect(
    page.getByRole('heading', { name: 'Não conseguimos abrir o catálogo' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Tentar novamente' }),
  ).toHaveAttribute('href', '/pokedex?page=2&type=ghost');
  await page.goto('/pokedex?type=water');
  await expect(page.getByText('Lista salva em')).toBeVisible();
  for (const query of [
    'type=grass&type=water',
    'type=Grass',
    'type=grass&search=25',
  ]) {
    await page.goto(`/pokedex?${query}`);
    await expect(
      page.getByRole('heading', {
        name: query.includes('search') ? 'Busca inválida' : 'Página inválida',
      }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Tipos de Pokémon' })
        .locator('[aria-current]'),
    ).toHaveCount(0);
  }
});

test('changing type discards delayed summaries from the previous selection', async ({
  page,
}) => {
  await page.route('**/api/catalog/summaries?ids=1,2,3', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue().catch(() => {});
  });
  await page.goto('/pokedex?type=grass');
  await expect(
    page.getByRole('heading', { name: 'bulbasaur', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Tipos de Pokémon' })
    .getByRole('link', { name: 'Fogo', exact: true })
    .click();
  await expect(
    page.getByText('3 de 3 Pokémon com detalhes disponíveis.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'charmander', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'bulbasaur', exact: true }),
  ).toHaveCount(0);
});
