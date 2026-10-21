import { describe, expect, it } from 'vitest';
import { artworkSchema, identifierSchema } from './index';
describe('public boundary schemas', () => {
  it('canonicalizes an identifier', () =>
    expect(identifierSchema.parse(' Pikachu ')).toBe('pikachu'));
  it.each([
    '../25',
    'https://example.com',
    '0',
    '9999999',
    'a'.repeat(65),
    'a?b',
  ])('rejects unsafe identifier %s', (value) =>
    expect(identifierSchema.safeParse(value).success).toBe(false),
  );
  it('supports unavailable artwork', () =>
    expect(artworkSchema.parse(null)).toBeNull());
  it.each([
    'https://example.com/25.png',
    'https://raw.githubusercontent.com/evil/25.png',
    'http://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png',
  ])('rejects unapproved artwork %s', (value) =>
    expect(artworkSchema.safeParse(value).success).toBe(false),
  );
});
