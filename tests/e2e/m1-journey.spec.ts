import { test, expect } from '@playwright/test';

for (const width of [375, 1280]) {
  test(`combined catalog to tabs, versioned moves, failed evolution preview and return at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/_next/image**', (route) =>
      new URL(route.request().url()).searchParams
        .get('url')
        ?.startsWith('https:')
        ? route.abort()
        : route.continue(),
    );
    await page.goto('/pokedex?type=electric&generation=1');
    const list = page.getByRole('list', {
      name: 'Pokémon encontrados neste grupo',
    });
    const href = await list.getByRole('link').first().getAttribute('href');
    expect(href).toContain('fromType=electric&fromGeneration=1&fromTypeAt=');
    await list.getByRole('link').first().click();
    const returnLink = page.getByRole('link', { name: 'Voltar à Pokédex' });
    const origin = await returnLink.getAttribute('href');
    expect(origin).toContain('type=electric&generation=1&typeAt=');
    for (const label of [
      'Habilidades',
      'Dados do Pokémon',
      'Sobre a espécie',
    ]) {
      await page.getByRole('tab', { name: label, exact: true }).click();
      await expect(page.getByRole('tabpanel')).toHaveAccessibleName(label);
    }
    await page.getByRole('tab', { name: 'Movimentos', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Movimentos', exact: true });
    await panel.getByLabel('Grupo de versões').selectOption('1');
    await panel
      .getByRole('button', { name: 'Consultar movimentos', exact: true })
      .click();
    await expect(
      panel.getByRole('article', { name: 'Movimento mega-punch', exact: true }),
    ).toBeVisible();
    await panel
      .getByRole('link', { name: 'Próximos movimentos', exact: true })
      .click();
    await expect(page).toHaveURL(/movePage=2#movimentos$/);
    await page.getByRole('tab', { name: 'Evoluções', exact: true }).click();
    const pichu = page.getByRole('article', {
      name: 'Espécie pichu',
      exact: true,
    });
    await pichu
      .getByRole('button', { name: 'Ver Pokémon padrão de pichu', exact: true })
      .click();
    await expect(
      pichu.getByText('Variedade ou detalhes indisponíveis.', { exact: false }),
    ).toBeVisible();
    await expect(pichu.getByRole('link')).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'Voltar à Pokédex' }),
    ).toHaveAttribute('href', origin!);
    await page.getByRole('link', { name: 'Voltar à Pokédex' }).click();
    await expect(page).toHaveURL(origin!);
    await expect(
      page.getByRole('heading', { name: 'pikachu', exact: true }),
    ).toBeVisible();
  });
}
