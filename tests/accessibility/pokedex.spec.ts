import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

async function gradientContrast(page: Page) {
  const results = await page.evaluate(() => {
    const pairs = [
      [
        '.sidebar-note',
        '.sidebar-note > strong, .sidebar-note > p, .small-label',
      ],
      [
        '.catalog-intro',
        '.catalog-intro h1, .catalog-intro h1 span, .catalog-intro p, .catalog-intro .eyebrow',
      ],
      [
        '.pokemon-hero',
        '.hero-number .eyebrow, #pokemon-title, .hero-description, .measurements span, .measurements strong, .measurements small',
      ],
      ['.hero-visual', '.art-caption'],
    ];
    const rgb = (value: string) =>
      [...value.matchAll(/rgba?\(([^)]+)\)/g)].map((match) =>
        match[1]!.split(',').slice(0, 3).map(Number),
      );
    const luminance = (values: number[]) =>
      values
        .map((value) => {
          const n = value / 255;
          return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
        })
        .reduce(
          (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!,
          0,
        );
    return pairs.flatMap(([backgroundSelector, textSelector]) => {
      const background = document.querySelector(backgroundSelector!);
      if (!background || !background.getClientRects().length) return [];
      let style = getComputedStyle(background);
      if (
        style.backgroundImage === 'none' &&
        background.closest('.pokemon-hero')
      )
        style = getComputedStyle(background.closest('.pokemon-hero')!);
      const base = rgb(style.backgroundColor)[0] ?? [255, 255, 255];
      const stops = [
        ...style.backgroundImage.matchAll(/rgba?\(([^)]+)\)/g),
      ].map((match) => {
        const values = match[1]!.split(',').map(Number);
        const alpha = values[3] ?? 1;
        return values
          .slice(0, 3)
          .map((value, index) => value * alpha + base[index]! * (1 - alpha));
      });
      if (!stops.length) return [];
      // A conservative per-channel minimum bounds every opaque pastel gradient stop.
      const lower = [0, 1, 2].map((index) =>
        Math.min(...stops.map((stop) => stop[index]!)),
      );
      const bg = luminance(lower);
      return [...document.querySelectorAll(textSelector!)]
        .filter((node) => node.getClientRects().length)
        .map((node) => {
          const color = rgb(getComputedStyle(node).color)[0]!;
          const fg = luminance(color);
          return {
            text: node.textContent?.trim(),
            ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05),
            foreground: color,
            backgroundBound: lower,
          };
        });
    });
  });
  expect(results.length, 'Gradient text must be evaluated').toBeGreaterThan(0);
  for (const result of results)
    expect(result.ratio, JSON.stringify(result)).toBeGreaterThanOrEqual(4.5);
  return results;
}

for (const width of [375, 1280]) {
  test(`WCAG audit, gradient contrast and active panels at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/_next/image**', (route) =>
      new URL(route.request().url()).searchParams
        .get('url')
        ?.startsWith('https:')
        ? route.abort()
        : route.continue(),
    );
    const evidence: unknown[] = [];
    async function audit(label: string) {
      await page.evaluate(() => document.fonts.ready);
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      evidence.push({
        label,
        violations: result.violations,
        incomplete: result.incomplete,
        gradientContrast: await gradientContrast(page),
      });
      await writeFile(
        testInfo.outputPath('accessibility.json'),
        JSON.stringify(evidence, null, 2),
      );
      expect(result.violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto('/pokedex?search=pikachu');
    await expect(
      page.getByRole('heading', { name: 'pikachu', exact: true }),
    ).toBeVisible();
    await audit('exact search');
    await page.goto('/pokedex?type=electric&generation=1');
    await expect(
      page.getByRole('heading', { name: 'pikachu', exact: true }),
    ).toBeVisible();
    await audit('combined filters and partial failure');
    await page.goto('/pokemon/25?moveVersion=1#atributos');
    for (const label of [
      'Atributos',
      'Habilidades',
      'Dados do Pokémon',
      'Sobre a espécie',
      'Evoluções',
      'Movimentos',
    ]) {
      const tab = page.getByRole('tab', { name: label, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tabpanel')).toHaveCount(1);
      await expect(page.getByRole('tabpanel')).toHaveAccessibleName(label);
      // Exercise ready controls/disclosures rather than auditing just a streamed skeleton.
      if (label === 'Movimentos')
        await expect(
          page.getByRole('article', {
            name: 'Movimento mega-punch',
            exact: true,
          }),
        ).toBeVisible();
      if (label === 'Sobre a espécie')
        await expect(
          page.getByText('When several of', { exact: false }),
        ).toBeVisible();
      if (label === 'Evoluções')
        await expect(
          page.getByRole('article', { name: 'Espécie pichu', exact: true }),
        ).toBeVisible();
      await audit(label);
    }
    if (width === 1280)
      await expect(
        page.getByRole('link', {
          name: 'PokéLab Trainer Studio — início',
          exact: true,
        }),
      ).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).scrollBehavior,
      ),
    ).toBe('auto');
  });
}
