import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { CONFIG } from './config.js';
import type { Config } from './config.js';
export interface CacheEntry {
  payload: unknown;
  fetchedAt: Date;
  expiresAt: Date;
}
export interface ResourceCache {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry): Promise<void>;
}
export const RESOURCE_CACHE = Symbol('RESOURCE_CACHE');
@Injectable()
export class PrismaCache
  implements ResourceCache, OnModuleInit, OnModuleDestroy
{
  readonly client: PrismaClient;
  private readonly logger = new Logger(PrismaCache.name);
  constructor(@Inject(CONFIG) config: Config) {
    this.client = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: config.DATABASE_URL,
        connectionTimeoutMillis: 2000,
        max: 4,
      }),
    });
  }
  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }
  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
  async get(key: string): Promise<CacheEntry | null> {
    return this.client.externalResourceCache.findUnique({
      where: { cacheKey: key },
      select: { payload: true, fetchedAt: true, expiresAt: true },
    });
  }
  async set(key: string, entry: CacheEntry): Promise<void> {
    // Serialization removes non-JSON prototypes; cache payloads are validated on read.
    const data = {
      fetchedAt: entry.fetchedAt,
      expiresAt: entry.expiresAt,
      payload: JSON.parse(JSON.stringify(entry.payload)),
    };
    try {
      await this.client.externalResourceCache.upsert({
        where: { cacheKey: key },
        create: { cacheKey: key, ...data },
        update: data,
      });
    } catch {
      this.logger.warn('Public cache write failed');
    }
  }
}
