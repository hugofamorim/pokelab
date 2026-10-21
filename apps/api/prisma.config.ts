import 'dotenv/config';
import { defineConfig } from 'prisma/config';
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://pokelab:pokelab_local@localhost:5432/pokelab',
  },
});
