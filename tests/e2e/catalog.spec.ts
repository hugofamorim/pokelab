import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/_next/image**', (route) => {
    const source = new URL(route.request().url()).searchParams.get('url');
    return source?.startsWith('https:') ? route.abort() : route.continue();
  });
});
for (const width of [375, 768, 1280, 1600]) {
  test(`catalog cards and navigation remain usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/pokedex');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Um mundo de Pokémon.Uma descoberta por vez.',
    );
    await expect(
      page.getByText('12 de 12 Pokémon com detalhes disponíveis.'),
    ).toBeVisible();
    const cards = page.getByRole('list', { name: 'Pokémon desta página' });
    await expect(cards.getByRole('listitem')).toHaveCount(12);
    await expect(
      cards.getByText('Planta', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      cards.getByText('Veneno', { exact: true }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/catalog-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('link', { name: 'Próxima', exact: true }).click();
    await expect(page).toHaveURL(/\/pokedex\?page=2$/);
    await expect(
      page.getByText('1 de 1 Pokémon com detalhes disponíveis.'),
    ).toBeVisible();
    await page
      .getByRole('list', { name: 'Pokémon desta página' })
      .getByRole('link')
      .click();
    await expect(page).toHaveURL(/\/pokemon\/25\?fromPage=2$/);
    await page.getByRole('link', { name: 'Voltar à Pokédex' }).click();
    await expect(page).toHaveURL(/\/pokedex\?page=2$/);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'pikachu', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel('Paginação do catálogo').getByText('Próxima'),
    ).toHaveAttribute('aria-disabled', 'true');
  });
}
test('shows reference names before summaries, bounds batches and retries only unavailable cards', async ({
  page,
}) => {
  const batches: string[] = [];
  let first = true;
  await page.route('**/api/catalog/summaries?*', async (route) => {
    const ids = new URL(route.request().url()).searchParams.get('ids')!;
    batches.push(ids);
    if (first) {
      first = false;
      await new Promise((resolve) => setTimeout(resolve, 600));
      const response = await route.fetch();
      const body = await response.json();
      body.items[1] = {
        id: 2,
        status: 'unavailable',
        code: 'UPSTREAM_UNAVAILABLE',
      };
      body.items[0].meta.stale = true;
      body.items[0].data.artwork = null;
      // Synthetic boundary label only in this intercepted test response.
      body.items[3].data.name =
        'fixture-pokemon-with-a-very-long-but-valid-canonical-form-name';
      await route.fulfill({ response, json: body });
    } else await route.continue();
  });
  await page.goto('/pokedex');
  await expect(
    page.getByRole('heading', { name: 'bulbasaur', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Carregando tipos e imagens…', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('11 de 12 Pokémon com detalhes disponíveis.'),
  ).toBeVisible();
  await expect(page.getByText('Dados salvos em')).toBeVisible();
  const longName = page.getByRole('link').filter({
    has: page.getByRole('heading', {
      name: 'fixture-pokemon-with-a-very-long-but-valid-canonical-form-name',
    }),
  });
  // The decorative halo intentionally extends beyond the card. Measure the actual
  // heading bounds instead of scrollHeight, which includes the clipped pseudo-element.
  for (const width of [375, 768, 1280, 1600]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await longName.evaluate((card) => {
        const bounds = card.getBoundingClientRect();
        const name = card.querySelector('h3')!.getBoundingClientRect();
        return (
          name.top >= bounds.top &&
          name.bottom <= bounds.bottom &&
          name.left >= bounds.left &&
          name.right <= bounds.right
        );
      }),
    ).toBe(true);
  }
  expect(batches).toEqual(['1,2,3,4', '5,6,7,8', '9,10,11,12']);
  await expect(
    page.getByText(
      'Tipos e imagem indisponíveis. Você ainda pode abrir o detalhe.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Tentar detalhes novamente' }).click();
  await expect(
    page.getByText('12 de 12 Pokémon com detalhes disponíveis.'),
  ).toBeVisible();
  expect(batches.at(-1)).toBe('2');
});
test('handles invalid, empty, stale and unavailable pages', async ({
  page,
}) => {
  await page.goto('/pokedex?page=01');
  await expect(
    page.getByRole('heading', { name: 'Página inválida' }),
  ).toBeVisible();
  await page.goto('/pokedex?page=1&page=2');
  await expect(
    page.getByRole('heading', { name: 'Página inválida' }),
  ).toBeVisible();
  await page.goto('/pokedex?type=grass');
  await expect(
    page.getByRole('heading', { name: 'Página inválida' }),
  ).toBeVisible();
  await page.goto('/pokedex?page=3');
  await expect(
    page.getByRole('heading', { name: 'Nenhum Pokémon nesta página' }),
  ).toBeVisible();
  await page.goto('/pokedex?page=999');
  await expect(
    page.getByRole('heading', { name: 'Não conseguimos abrir o catálogo' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Tentar novamente' }),
  ).toHaveAttribute('href', '/pokedex?page=999');
  await page.goto('/pokedex?page=998');
  await expect(page.getByText('Lista salva em')).toBeVisible();
  await page.goto('/pokedex?page=997', { waitUntil: 'commit' });
  await expect(
    page.getByRole('status', { name: 'Carregando catálogo' }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Nenhum Pokémon nesta página' }),
  ).toBeVisible();
});
test('handles whole batch failure and keyboard navigation at 200 percent zoom', async ({
  page,
}) => {
  await page.route('**/api/catalog/summaries?*', (route) =>
    route.fulfill({ status: 503, json: { code: 'CATALOG_UNAVAILABLE' } }),
  );
  await page.goto('/pokedex');
  await expect(
    page.getByText('0 de 12 Pokémon com detalhes disponíveis.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Tentar detalhes novamente' }),
  ).toBeVisible();
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
