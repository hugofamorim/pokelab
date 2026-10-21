import { z } from 'zod';
export const configSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine((value) =>
      ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
    ),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  POKEAPI_TIMEOUT_MS: z.coerce.number().int().min(100).max(15000).default(5000),
  POKEAPI_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(604800)
    .default(86400),
});
export type Config = z.infer<typeof configSchema>;
export const CONFIG = Symbol('CONFIG');
