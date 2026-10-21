CREATE TABLE "ExternalResourceCache" (
    "cacheKey" VARCHAR(128) NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "ExternalResourceCache_pkey" PRIMARY KEY ("cacheKey")
);
CREATE INDEX "ExternalResourceCache_expiresAt_idx" ON "ExternalResourceCache"("expiresAt");
