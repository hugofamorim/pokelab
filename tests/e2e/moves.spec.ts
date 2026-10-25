import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/_next/image**', (route) =>
    new URL(route.request().url()).searchParams.get('url')?.startsWith('https:')
      ? route.abort()
      : route.continue(),
  );
});
for (const width of [375, 768, 1280, 1600]) {
  test(`explicit version selection bounded move pages and on-demand attributes at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/moves/'))
        requests.push(new URL(request.url()).pathname);
    });
    await page.goto('/pokemon/25?fromPage=2&fromType=electric#movimentos');
    const panel = page.getByRole('region', { name: 'Movimentos', exact: true });
    await expect(panel.getByLabel('Grupo de versões')).toHaveValue('');
    await expect(panel.getByRole('article')).toHaveCount(0);
    expect(requests).toEqual([]);
    await panel.getByLabel('Grupo de versões').selectOption('1');
    expect(requests).toEqual([]);
    await panel
      .getByRole('button', { name: 'Consultar movimentos', exact: true })
      .click();
    await expect(page).toHaveURL(
      /fromPage=2&fromType=electric&moveVersion=1#movimentos$/,
    );
    await expect(
      panel
        .getByRole('list', { name: 'Movimentos em red-blue', exact: true })
        .locator(':scope > li'),
    ).toHaveCount(6);
    await expect(
      panel.getByText('27 movimentos registrados', { exact: true }),
    ).toBeVisible();
    const punch = panel.getByRole('article', {
      name: 'Movimento mega-punch',
      exact: true,
    });
    await punch.locator('summary').focus();
    await page.keyboard.press('Space');
    await expect(
      punch.getByText('Máquina · machine (#4)', { exact: true }),
    ).toBeVisible();
    await expect(punch.locator('dd').filter({ hasText: /^0$/ })).toHaveCount(1);
    await expect(
      punch.getByText('Não informado', { exact: true }),
    ).toBeVisible();
    await punch.getByRole('button').click();
    await expect(
      punch.getByRole('heading', { name: 'Atributos atuais da fonte' }),
    ).toBeVisible();
    expect(requests).toEqual(['/api/moves/5']);
    await expect(
      punch.getByText('Estes valores não foram recalculados para red-blue.', {
        exact: false,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await panel.screenshot({
      path: `artifacts/moves-${width}.png`,
    });
    await panel.getByRole('link', { name: 'Próximos movimentos' }).click();
    await expect(page).toHaveURL(
      /fromPage=2&fromType=electric&moveVersion=1&movePage=2#movimentos$/,
    );
    await expect(
      panel.getByRole('article', { name: 'Movimento mega-punch', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'Voltar à Pokédex' }),
    ).toHaveAttribute('href', '/pokedex?page=2&type=electric');
    await page.goBack();
    await expect(panel.getByLabel('Grupo de versões')).toHaveValue('1');
    await panel.getByLabel('Grupo de versões').selectOption('2');
    await panel
      .getByRole('button', { name: 'Consultar movimentos', exact: true })
      .click();
    await expect(
      panel.getByText('30 movimentos registrados', { exact: true }),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/movePage=2/);
  });
}
test('source loading error retry missing empty invalid and out-of-range states stay independent', async ({
  page,
}) => {
  await page.goto('/pokemon/7#movimentos', { waitUntil: 'commit' });
  await expect(
    page.getByRole('status', { name: 'Carregando movimentos' }),
  ).toBeVisible();
  await expect(page.getByRole('meter')).toHaveCount(0);
  await expect(page.locator('#atributos meter')).toHaveCount(6);
  await expect(
    page.getByText(
      'A fonte não informou registros de aprendizado para esta entrada Pokémon.',
      { exact: false },
    ),
  ).toBeVisible();
  await page.goto(
    '/pokemon/3?fromGeneration=4&fromPage=2&moveVersion=1#movimentos',
  );
  const panel = page.getByRole('region', { name: 'Movimentos', exact: true });
  await expect(
    panel.getByText('Não conseguimos carregar os movimentos deste Pokémon.', {
      exact: true,
    }),
  ).toBeVisible();
  await panel
    .getByRole('button', { name: 'Tentar movimentos novamente' })
    .click();
  await expect(
    panel.getByRole('button', { name: 'Tentar movimentos novamente' }),
  ).toBeEnabled();
  await expect(page).toHaveURL(/moveVersion=1#movimentos$/);
  await page.goto('/pokemon/2#movimentos');
  await expect(
    panel.getByText(
      'Os registros de movimentos desta entrada não foram encontrados na fonte.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto('/pokemon/5#movimentos');
  await expect(
    panel.getByText('Não conseguimos carregar os movimentos deste Pokémon.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto('/pokemon/25?moveVersion=1&moveVersion=2#movimentos');
  await expect(
    panel.getByText('A seleção de movimentos é inválida.', { exact: false }),
  ).toBeVisible();
  await panel.getByRole('link', { name: 'Escolher versões novamente' }).click();
  await expect(panel.getByLabel('Grupo de versões')).toHaveValue('');
  await page.goto('/pokemon/25?moveVersion=999999#movimentos');
  await expect(
    panel.getByText(
      'Não há registros de aprendizado para este grupo no conjunto de dados consultado.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto('/pokemon/25?moveVersion=1&movePage=1000#movimentos');
  await expect(
    panel.getByText('Esta página não contém movimentos.', { exact: true }),
  ).toBeVisible();
  await panel
    .getByRole('link', { name: 'Voltar à primeira página de movimentos' })
    .click();
  await expect(panel.getByRole('article')).toHaveCount(6);
});
test('current Charm attributes and historical boundary keep null values and independent freshness at 200 percent text zoom', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.goto(
    '/pokemon/25?fromSearch=pikachu&moveVersion=20&movePage=5#movimentos',
  );
  const panel = page.getByRole('region', { name: 'Movimentos', exact: true });
  await expect(
    panel.getByText('Registros de aprendizado · dados salvos em', {
      exact: false,
    }),
  ).toBeVisible();
  const charm = panel.getByRole('article', {
    name: 'Movimento charm',
    exact: true,
  });
  await charm.getByRole('button').click();
  await expect(
    charm.getByRole('heading', { name: 'Atributos atuais da fonte' }),
  ).toBeVisible();
  await expect(
    charm.getByText('Atributos do movimento · dados salvos em', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(charm.getByText('Fada', { exact: true })).toBeVisible();
  await expect(
    charm
      .locator('.move-metadata > .move-values')
      .getByText('Não informado', { exact: true }),
  ).toBeVisible();
  await charm.locator('.move-history summary').click();
  await expect(charm.getByText('normal (#1)', { exact: true })).toBeVisible();
  await expect(charm.getByText('x-y (#15)', { exact: true })).toBeVisible();
  await expect(
    charm.getByText('Sem alteração informada', { exact: true }),
  ).toHaveCount(3);
  await page.addStyleTag({ content: 'html {font-size: 200% !important}' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'artifacts/moves-history-zoom.png',
    fullPage: true,
  });
  await expect(
    page.getByRole('link', { name: 'Voltar à Pokédex' }),
  ).toHaveAttribute('href', '/pokedex?search=pikachu');
});
test('obsolete metadata selection is cancelled and malformed mismatched missing and failed responses never render attributes', async ({
  page,
}) => {
  await page.goto('/pokemon/25?moveVersion=1#movimentos');
  const panel = page.getByRole('region', { name: 'Movimentos', exact: true });
  const punch = panel.getByRole('article', {
    name: 'Movimento mega-punch',
    exact: true,
  });
  const payday = panel.getByRole('article', {
    name: 'Movimento pay-day',
    exact: true,
  });
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/moves/5', async (route) => {
    const response = await route.fetch();
    await hold;
    await route.fulfill({ response }).catch(() => {});
  });
  await punch.getByRole('button').click();
  await expect(
    punch.getByText('Carregando atributos de mega-punch…', { exact: true }),
  ).toBeVisible();
  await payday.getByRole('button').click();
  await expect(
    payday.getByRole('heading', { name: 'Atributos atuais da fonte' }),
  ).toBeVisible();
  release();
  await expect(
    punch.getByRole('heading', { name: 'Atributos atuais da fonte' }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole('heading', { name: 'Atributos atuais da fonte' }),
  ).toHaveCount(1);
  await page.unroute('**/api/moves/5');
  await page.route('**/api/moves/5', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.data.move.name = 'wrong-name';
    await route.fulfill({ json: data });
  });
  await punch.getByRole('button').click();
  await expect(
    punch.getByText('Não conseguimos carregar os atributos deste movimento.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute('**/api/moves/5');
  await page.route('**/api/moves/5', (route) =>
    route.fulfill({ status: 404, json: { code: 'MOVE_NOT_FOUND' } }),
  );
  await punch.getByRole('button').click();
  await expect(
    punch.getByText('A fonte não encontrou os atributos deste movimento.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute('**/api/moves/5');
  await page.route('**/api/moves/5', (route) =>
    route.fulfill({ status: 503, json: { code: 'MOVE_UNAVAILABLE' } }),
  );
  await punch.getByRole('button').click();
  await expect(
    punch.getByText('Não conseguimos carregar os atributos deste movimento.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute('**/api/moves/5');
  await punch.getByRole('button').click();
  await expect(
    punch.getByRole('heading', { name: 'Atributos atuais da fonte' }),
  ).toBeVisible();
  await expect(
    punch.getByText('Atributos do movimento · consulta em', { exact: false }),
  ).toBeVisible();
  await panel.getByRole('link', { name: 'Próximos movimentos' }).click();
  await expect(
    panel.getByRole('heading', { name: 'Atributos atuais da fonte' }),
  ).toHaveCount(0);
});
test('native version submission and learning disclosures work before application hydration', async ({
  page,
}) => {
  await page.route('**/_next/static/**/*.js', (route) => route.abort());
  await page.goto('/pokemon/25?fromPage=2&fromGeneration=4#movimentos');
  const panel = page.getByRole('region', { name: 'Movimentos', exact: true });
  await panel.getByLabel('Grupo de versões').selectOption('1');
  await panel
    .getByRole('button', { name: 'Consultar movimentos', exact: true })
    .click();
  await expect(page).toHaveURL(
    /fromPage=2&fromGeneration=4&moveVersion=1#movimentos$/,
  );
  const punch = panel.getByRole('article', {
    name: 'Movimento mega-punch',
    exact: true,
  });
  await punch.locator('summary').click();
  await expect(
    punch.getByText('Máquina · machine (#4)', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Voltar à Pokédex' }),
  ).toHaveAttribute('href', '/pokedex?page=2&generation=4');
});
