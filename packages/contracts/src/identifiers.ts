import { z } from 'zod';

export const identifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(64)
  .regex(/^(?:[1-9]\d{0,5}|[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/);
