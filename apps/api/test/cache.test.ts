import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { PrismaCache } from '../src/cache.js';
import { configSchema } from '../src/config.js';
describe('PostgreSQL public cache', () => {
  const config = configSchema.parse({
    DATABASE_URL:
      process.env.DATABASE_URL ??
      'postgresql://pokelab:pokelab_local@localhost:5432/pokelab',
  });
  const key = `test:${randomUUID()}`;
  it('persists JSON and timestamps across client instances', async () => {
    const first = new PrismaCache(config);
    const second = new PrismaCache(config);
    try {
      await first.onModuleInit();
      const entry = {
        payload: { id: 25 },
        fetchedAt: new Date('2026-10-21T12:00:00.000Z'),
        expiresAt: new Date('2026-10-22T12:00:00.000Z'),
      };
      await first.set(key, entry);
      await first.onModuleDestroy();
      await second.onModuleInit();
      expect(await second.get(key)).toEqual(entry);
      expect(await second.get(`${key}:missing`)).toBeNull();
    } finally {
      await second.client.externalResourceCache.deleteMany({
        where: { cacheKey: key },
      });
      await Promise.all([first.onModuleDestroy(), second.onModuleDestroy()]);
    }
  });
});
