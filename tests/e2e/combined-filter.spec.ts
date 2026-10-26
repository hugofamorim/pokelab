import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/_next/image**', (route) =>
    new URL(route.request().url()).searchParams.get('url')?.startsWith('https:')
      ? route.abort()
      : route.continue(),
  );
});
for (const width of [375, 768, 1280, 1600]) {
  test(`combined controls, bounded next window and detail return at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/pokedex?type=electric');
    const types = page.getByRole('navigation', { name: 'Tipos de Pokémon' });
    const generations = page.getByRole('navigation', {
      name: 'Gerações de Pokémon',
    });
    const generation = generations.getByRole('link', {
      name: 'Geração I',
      exact: true,
    });
    await generation.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/type=electric&generation=1$/);
    await expect(generation).toHaveAttribute('aria-current', 'true');
    await expect(
      types.getByRole('link', { name: 'Elétrico', exact: true }),
    ).toHaveAttribute('aria-current', 'true');
    const region = page.getByRole('region', {
      name: 'Consulta por tipo e geração',
    });
    await expect(
      region.getByText(
        'Neste grupo: 4 avaliados, 1 encontrados, 0 fora da geração e 3 sem confirmação.',
      ),
    ).toBeVisible();
    await expect(
      region.getByText('Falhas não são exclusões.', { exact: false }),
    ).toBeVisible();
    await expect(
      region.getByRole('link', { name: 'Consultar próximos candidatos' }),
    ).toHaveAttribute('href', /after=82&typeAt=.*&generationAt=/);
    await page.screenshot({
      path: `artifacts/combined-${width}.png`,
      fullPage: true,
    });
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
    await page.evaluate(() => {
      document.documentElement.style.zoom = '';
    });
    const card = region
      .getByRole('list', { name: 'Pokémon encontrados neste grupo' })
      .getByRole('link');
    await expect(card).toHaveAttribute(
      'href',
      /fromType=electric&fromGeneration=1&fromTypeAt=/,
    );
    await card.click();
    await page.getByRole('link', { name: 'Voltar à Pokédex' }).click();
    await expect(
      region.getByRole('heading', { name: 'pikachu', exact: true }),
    ).toBeVisible();
    await page.reload();
    await region
      .getByRole('link', { name: 'Consultar próximos candidatos' })
      .click();
    await expect(page).toHaveURL(/after=82/);
    await expect(
      region.getByText('Nenhum resultado confirmado neste grupo.', {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      region.getByText('Há mais candidatos para consultar.', { exact: false }),
    ).toBeVisible();
    await page.goBack();
    await expect(
      region.getByRole('heading', { name: 'pikachu', exact: true }),
    ).toBeVisible();
    await generations.getByRole('link', { name: 'Todas', exact: true }).click();
    await expect(page).toHaveURL(/page=1&type=electric$/);
    await generation.click();
    await types.getByRole('link', { name: 'Todos', exact: true }).click();
    await expect(page).toHaveURL(/page=1&generation=1$/);
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
test('empty nonfinal window, exclusions, completion and index change restart', async ({
  page,
}) => {
  await page.goto('/pokedex?type=grass&generation=4');
  await expect(
    page.getByText(
      'Neste grupo: 3 avaliados, 0 encontrados, 3 fora da geração e 0 sem confirmação.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText('Este é o fim dos candidatos.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Consultar próximos candidatos' }),
  ).toHaveCount(0);
  const typeAt = '2026-10-01T00:00:00Z';
  await page.goto(
    '/pokedex?' +
      new URLSearchParams({
        type: 'electric',
        generation: '1',
        after: '82',
        typeAt,
        generationAt: typeAt,
      }),
  );
  await expect(
    page.getByRole('heading', { name: 'Os índices foram atualizados' }),
  ).toBeVisible();
  await expect(page.locator('.pokemon-card')).toHaveCount(0);
  await page.getByRole('link', { name: 'Reiniciar consulta' }).click();
  await expect(page).toHaveURL(/type=electric&generation=1$/);
  await expect(
    page.getByRole('heading', { name: 'pikachu', exact: true }),
  ).toBeVisible();
});
test('index failure retries current group and search clears both filters', async ({
  page,
}) => {
  await page.goto('/pokedex?type=ghost&generation=1');
  await expect(
    page.getByRole('heading', { name: 'Não conseguimos consultar este grupo' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Tentar este grupo novamente' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Tentar este grupo novamente' }),
  ).toBeEnabled();
  await expect(page).toHaveURL(/type=ghost&generation=1$/);
  const input = page.getByRole('searchbox');
  await input.fill('pikachu');
  await input.press('Enter');
  await expect(page).toHaveURL(/search=pikachu$/);
  await expect(page.locator('.type-filter [aria-current]')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'pikachu', exact: true }),
  ).toBeVisible();
});
test('loading boundary and invalid combined URL recovery', async ({ page }) => {
  await page.goto('/pokedex?type=grass&generation=2', { waitUntil: 'commit' });
  await expect(
    page.getByRole('status', { name: 'Carregando catálogo' }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Neste grupo: 3 avaliados, 0 encontrados, 3 fora da geração e 0 sem confirmação.',
    ),
  ).toBeVisible();
  await page.goto('/pokedex?type=grass&generation=1&after=4');
  await expect(
    page.getByRole('heading', { name: 'Página inválida' }),
  ).toBeVisible();
});
