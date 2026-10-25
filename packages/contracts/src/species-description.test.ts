import { describe, expect, it } from 'vitest';
import {
  speciesDescriptionSchema,
  speciesIdParamSchema,
} from './species-description.js';

describe('species descriptions', () => {
  const data = {
    species: { speciesId: 413, name: 'wormadam' },
    description: {
      text: 'A source description.',
      language: 'en',
      version: 'diamond',
    },
  };
  it('accepts source provenance and an explicitly absent supported description', () => {
    expect(speciesDescriptionSchema.parse(data)).toEqual(data);
    expect(
      speciesDescriptionSchema.parse({ ...data, description: null })
        .description,
    ).toBeNull();
    expect(
      speciesDescriptionSchema.parse({
        ...data,
        description: { ...data.description, language: 'pt-br' },
      }).description?.language,
    ).toBe('pt-br');
  });
  it.each([
    '',
    ' text',
    'text ',
    'two  spaces',
    'line\nbreak',
    'page\fbreak',
    '\u0000text',
    'x'.repeat(8193),
  ])('rejects non-normalized or excessive text %j', (text) => {
    expect(
      speciesDescriptionSchema.safeParse({
        ...data,
        description: { ...data.description, text },
      }).success,
    ).toBe(false);
  });
  it.each(['pt', 'en-us', 'fr', ''])(
    'does not relabel unsupported source language %s',
    (language) => {
      expect(
        speciesDescriptionSchema.safeParse({
          ...data,
          description: { ...data.description, language },
        }).success,
      ).toBe(false);
    },
  );
  it.each([
    '0',
    '01',
    '1.5',
    '-1',
    '1000000',
    '1\n',
    ' 1',
    'https://example.org',
  ])('rejects unsafe ID %j', (value) => {
    expect(speciesIdParamSchema.safeParse(value).success).toBe(false);
  });
});
