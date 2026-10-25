import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/_next/image**', (route) =>
    new URL(route.request().url()).searchParams.get('url')?.startsWith('https:')
      ? route.abort()
      : route.continue(),
  );
});
for (const width of [375, 768, 1280, 1600]) {
  test(`evolution branches conditions and mapped return remain usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/catalog/generation-cards?'))
        requests.push(new URL(request.url()).searchParams.get('speciesIds')!);
    });
    await page.goto('/pokemon/133?fromSearch=eevee');
    await page.getByRole('tab', { name: 'Evoluções', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Evoluções', exact: true });
    await expect(
      panel
        .getByRole('list', { name: 'Evoluções de eevee', exact: true })
        .locator(':scope > li'),
    ).toHaveCount(8);
    await expect(
      panel
        .getByRole('article', { name: 'Espécie eevee', exact: true })
        .getByText('Espécie desta entrada'),
    ).toBeVisible();
    await expect(panel.getByRole('link')).toHaveCount(0);
    expect(requests).toEqual([]);
    await expect(page).toHaveURL(/#evolucoes$/);
    const vaporeon = panel.getByRole('article', {
      name: 'Espécie vaporeon',
      exact: true,
    });
    await expect(
      vaporeon.getByText('Evolui de', { exact: false }),
    ).toContainText('eevee');
    await vaporeon
      .getByText('Condições para vaporeon', { exact: false })
      .click();
    const record = vaporeon
      .locator('.evolution-records > li')
      .first()
      .locator('details');
    await record.locator('summary').focus();
    await page.keyboard.press('Space');
    await expect(record).toHaveAttribute('open', '');
    await expect(
      record.getByText('water-stone (#84)', { exact: true }),
    ).toBeVisible();
    await expect(
      record.getByText('eevee (#133)', { exact: true }),
    ).toBeVisible();
    await expect(
      panel.getByText('Cadeia de evoluções salva em', { exact: false }),
    ).toBeVisible();
    await vaporeon
      .getByRole('button', { name: 'Ver Pokémon padrão de vaporeon' })
      .click();
    const detailLink = vaporeon.getByRole('link');
    await expect(detailLink).toHaveAttribute(
      'href',
      '/pokemon/134?fromSearch=eevee',
    );
    expect(requests).toEqual(['134']);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/evolution-${width}.png`,
      fullPage: true,
    });
    await detailLink.click();
    await expect(
      page.getByRole('heading', { name: 'vaporeon', exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Voltar à Pokédex' }),
    ).toHaveAttribute('href', '/pokedex?search=eevee');
  });
}
test('evolution source failure absence single-node and unspecified conditions stay distinct', async ({
  page,
}) => {
  await page.goto('/pokemon/7#evolucoes', { waitUntil: 'commit' });
  await expect(
    page.getByRole('heading', { name: 'squirtle', exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('status', { name: 'Carregando evoluções' }),
  ).toBeVisible();
  await expect(page.getByRole('meter')).toHaveCount(0);
  await expect(page.locator('#atributos meter')).toHaveCount(6);
  await expect(
    page.getByText(
      'A fonte não informou uma cadeia de evolução para esta espécie.',
    ),
  ).toBeVisible();
  await page.goto('/pokemon/6#evolucoes');
  await expect(
    page.getByText(
      'Esta cadeia contém apenas uma espécie, sem evoluções listadas.',
    ),
  ).toBeVisible();
  await page.goto('/pokemon/1#evolucoes');
  await expect(
    page.getByText('Requisitos não informados pela fonte.', { exact: false }),
  ).toBeVisible();
  await page.goto('/pokemon/2#evolucoes');
  await expect(
    page.getByText(
      'Os dados de evolução desta espécie não foram encontrados na fonte.',
    ),
  ).toBeVisible();
  await page.goto('/pokemon/3?fromPage=2&fromType=grass#evolucoes');
  await expect(
    page.getByText('Não conseguimos carregar as evoluções desta espécie.'),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Tentar evoluções novamente' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Tentar evoluções novamente' }),
  ).toBeEnabled();
  await expect(page).toHaveURL(/fromPage=2&fromType=grass#evolucoes$/);
  await expect(page.getByRole('meter')).toHaveCount(0);
  await expect(page.locator('#atributos meter')).toHaveCount(6);
  await page.goto('/pokemon/5#evolucoes');
  await expect(
    page.getByText('Não conseguimos carregar as evoluções desta espécie.'),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Evoluções', exact: true })
      .getByText('identity-mismatch', { exact: false }),
  ).toHaveCount(0);
});
test('form conditions and opaque source expressions remain separate at 200 percent zoom', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/pokemon/206#evolucoes');
  const panel = page.getByRole('region', { name: 'Evoluções', exact: true });
  const target = panel.getByRole('article', {
    name: 'Espécie dudunsparce',
    exact: true,
  });
  await target
    .getByText('Condições para dudunsparce', { exact: false })
    .click();
  await expect(target.locator('.evolution-records > li')).toHaveCount(2);
  for (const record of await target
    .locator('.evolution-records > li > details')
    .all())
    await record.locator('summary').click();
  await expect(
    target.getByText('dudunsparce-two-segment (#982)', { exact: true }),
  ).toBeVisible();
  await expect(
    target.getByText('dudunsparce-three-segment (#10424)', { exact: true }),
  ).toBeVisible();
  await expect(
    target.getByText('EC 100 % 0 ==', { exact: false }),
  ).toBeVisible();
  await expect(
    target.getByText('EC 100 % 0 !=', { exact: false }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'artifacts/evolution-form-zoom.png',
    fullPage: true,
  });
});
test('mapping requests happen on demand cancel on selection and never infer failed links', async ({
  page,
}) => {
  let release!: () => void;
  await page.route(
    '**/api/catalog/generation-cards?speciesIds=133',
    async (route) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.continue().catch(() => {});
    },
  );
  await page.goto('/pokemon/133?fromPage=3&fromGeneration=1#evolucoes');
  const panel = page.getByRole('region', { name: 'Evoluções', exact: true });
  const eevee = panel.getByRole('article', {
    name: 'Espécie eevee',
    exact: true,
  });
  const vaporeon = panel.getByRole('article', {
    name: 'Espécie vaporeon',
    exact: true,
  });
  await eevee
    .getByRole('button', { name: 'Ver Pokémon padrão de eevee' })
    .click();
  await expect(
    eevee.getByText('Validando a variedade padrão e seus dados…'),
  ).toBeVisible();
  await vaporeon
    .getByRole('button', { name: 'Ver Pokémon padrão de vaporeon' })
    .click();
  await expect(vaporeon.getByRole('link')).toHaveAttribute(
    'href',
    '/pokemon/134?fromPage=3&fromGeneration=1',
  );
  release();
  await expect(eevee.getByRole('link')).toHaveCount(0);
  const flareon = panel.getByRole('article', {
    name: 'Espécie flareon',
    exact: true,
  });
  await flareon
    .getByRole('button', { name: 'Ver Pokémon padrão de flareon' })
    .click();
  await expect(
    flareon.getByText('Variedade ou detalhes indisponíveis.', { exact: false }),
  ).toBeVisible();
  await expect(flareon.getByRole('link')).toHaveCount(0);
  await expect(
    flareon.getByRole('button', { name: 'Tentar variedade novamente' }),
  ).toBeEnabled();
  await page.route('**/api/catalog/generation-cards?speciesIds=136', (route) =>
    route.fulfill({ status: 200, json: { items: [] } }),
  );
  await flareon
    .getByRole('button', { name: 'Tentar variedade novamente' })
    .click();
  await expect(flareon.getByRole('link')).toHaveCount(0);
});
test('mapped-card freshness stays independent and cross-source names cannot create a link', async ({
  page,
}) => {
  await page.route(
    '**/api/catalog/generation-cards?speciesIds=134',
    async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.items[0].mapping.meta.stale = true;
      body.items[0].summary.meta.stale = true;
      await route.fulfill({ response, json: body });
    },
  );
  await page.goto('/pokemon/133#evolucoes');
  const panel = page.getByRole('region', { name: 'Evoluções', exact: true });
  const target = panel.getByRole('article', {
    name: 'Espécie vaporeon',
    exact: true,
  });
  await target
    .getByRole('button', { name: 'Ver Pokémon padrão de vaporeon' })
    .click();
  await expect(target.getByRole('link')).toHaveAttribute(
    'href',
    '/pokemon/134?fromPage=1',
  );
  await expect(
    target.getByText('Mapeamento salvo em', { exact: false }),
  ).toBeVisible();
  await expect(
    target.getByText('Dados do Pokémon salvos em', { exact: false }),
  ).toBeVisible();
  await page.unroute('**/api/catalog/generation-cards?speciesIds=134');
  await page.route(
    '**/api/catalog/generation-cards?speciesIds=134',
    async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.items[0].mapping.data.species.name = 'cross-source-mismatch';
      body.items[0].summary.data.species.name = 'cross-source-mismatch';
      await route.fulfill({ response, json: body });
    },
  );
  await target
    .getByRole('button', { name: 'Ver Pokémon padrão de vaporeon' })
    .click();
  await expect(
    target.getByText('Variedade ou detalhes indisponíveis.', { exact: false }),
  ).toBeVisible();
  await expect(target.getByRole('link')).toHaveCount(0);
});

test('native condition details render before application hydration', async ({
  page,
}) => {
  await page.route('**/_next/static/**/*.js', (route) => route.abort());
  await page.goto('/pokemon/133#evolucoes');
  const panel = page.getByRole('region', { name: 'Evoluções', exact: true });
  const target = panel.getByRole('article', {
    name: 'Espécie vaporeon',
    exact: true,
  });
  await target.getByText('Condições para vaporeon', { exact: false }).click();
  await target
    .locator('.evolution-records > li')
    .first()
    .locator('summary')
    .click();
  await expect(
    target.getByText('water-stone (#84)', { exact: true }),
  ).toBeVisible();
  await expect(panel.getByRole('link')).toHaveCount(0);
});
