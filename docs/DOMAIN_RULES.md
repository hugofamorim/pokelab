# Pokémon domain rules — v1

## Canonical terms

- `Pokemon`: an API form-specific combatant entry with typings, stats and moves.
- `Species`: underlying species with evolution reference and flavor text; may cover forms.
- `TeamSlot`: one selected combatant and optionally chosen moves; slot indexes 0..5.
- `Ruleset`: pinned type chart plus declared generation assumptions; no implicit blending of generations.
- `Analysis`: deterministic calculations limited to selected ruleset and user-selected facts.

## Team validation

- 1 to 6 occupied slots in valid analysis request (draft may be empty); unique slots 0–5; no duplicate species by default in standard mode. Clearly signal unsupported forms and unknown types.
- Name length 1–60 after trimming; description max 500; team URL import max bounded bytes (recommend <=4 KB encoded) and `schemaVersion` required.
- Only valid known Pokémon identifiers accepted; do not trust labels provided in imported URLs as official data.

## Type chart

- 18 attacking types and 18 defending types for baseline ruleset.
- For `defenders = [A,B]`, multiplier = effectiveness(attack,A) * effectiveness(attack,B). Do not add or average.
- Examples: Fire -> Grass = 2; Electric -> Ground = 0; Ice -> Dragon/Flying = 4; Ground -> Flying = 0; Grass -> Water/Ground = 4; Fire -> Water/Dragon = 0.25.
- The source chart is versioned and validated. Attacks and defenses with non-baseline types are unsupported until an explicit ruleset adds them.
- Defensive categories for a Pokémon: immune `=0`; resistant `<1`; neutral `=1`; weak `>1`.
- For team report: per attacking type, weakCount, resistCount, immuneCount, neutralCount, and member multipliers. An entire team is not assigned one aggregate damage multiplier.
- Recommendations from documented heuristics: e.g., `>=3` team members weak to same type -> flag stacking weakness; always explain rule and don't state a win probability.
- Offensive approximation: user move types if validated; otherwise report coverage based on STAB-compatible own types and mark it _type-only theoretical coverage_. Don't invent move legality or generation mechanics.

## External metadata quality

- Not all flavor entries have pt-BR; use en-US fallback with label indicating source language.
- Some Pokémon artwork URLs are absent; use fallback illustration/icon with descriptive alt text.
- Some forms and move pools differ by game; show 'unknown' rather than incorrect universal availability.
- The generation membership index describes the generation in which a species was
  introduced. It is not a regional Pokédex, game-availability list, historical typing
  snapshot, or the generation in which every variety/form appeared. Species references
  expose `speciesId`; resolve a default variety from validated species data before using
  a Pokémon entry/detail/summary ID. Never infer that mapping from equal numeric IDs.

## Unit test matrix

- Every chart type combination; dual type multiplier composition and immunities.
- Empty team, one member, six members, invalid seventh slot, duplicate handling.
- Overlapping weaknesses, multiple immunities, form/type differences.
- Fuzz/property tests: no negative or NaN multipliers; no side effects or mutation of input.
