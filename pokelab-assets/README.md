# PokéLab asset pack — existing artwork

Includes previously generated visuals, renamed and organized for Next.js.

- `brand/pokelab-logo.png` — logo
- `avatars/trainer-male.png`, `avatars/trainer-female.png` — avatar badges
- `icons/icon-*.png` — individual icon crops from the original artwork sheet
- `references/icons-source-sheet.png` — original icon sheet, for verification

Copy these folders into `apps/web/public/assets/` and refer to an asset as `/assets/brand/pokelab-logo.png`.

**Important:** The icons have been cut out from a single generated PNG, not redrawn as vectors. The original sheet has some speckling/artifacting in the transparent areas; inspect individual icons before production use. These are raster PNGs, not SVGs. This pack contains only assets that existed; no new Pokémon backdrop images or mascot characters are included.
