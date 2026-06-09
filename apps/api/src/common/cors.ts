import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';
import { DatabaseService } from '../database/database.service.js';

// How long the allowed-origins set is cached before we re-read it from the DB.
// Short enough that re-seeding a new origin is picked up quickly, long enough
// that a burst of requests doesn't hammer Postgres on every CORS preflight.
const ORIGINS_CACHE_TTL_MS = 30_000;

/**
 * Builds the CORS config for the whole app (v0-4.10).
 *
 * The browser enforces CORS per-request via response headers, but the origin
 * check happens before routing, so we have no project context. The pragmatic v0
 * rule: allow an origin if it is the dashboard origin OR it appears in ANY
 * project's `allowed_origins` (the union). For a single seeded project this is
 * exactly "the demo site + the dashboard"; it stays correct as projects grow.
 *
 * The union is cached with a short TTL so we don't query Postgres on every
 * preflight. Requests with no Origin header (curl, same-origin, server-to-server)
 * are allowed through — CORS only governs cross-origin browser calls.
 */
export function buildCorsOptions(
  db: DatabaseService,
  dashboardOrigin: string,
): CorsOptions {
  let cache: Set<string> | null = null;
  let cachedAt = 0;

  async function allowedOrigins(): Promise<Set<string>> {
    const now = Date.now();
    if (cache && now - cachedAt < ORIGINS_CACHE_TTL_MS) {
      return cache;
    }
    // unnest expands the allowed_origins TEXT[] of every project into rows.
    const result = await db.query<{ origin: string }>(
      'SELECT DISTINCT unnest(allowed_origins) AS origin FROM projects',
    );
    const set = new Set(result.rows.map((r) => r.origin));
    set.add(dashboardOrigin);
    cache = set;
    cachedAt = now;
    return set;
  }

  return {
    origin: (origin, callback) => {
      // No Origin header -> not a cross-origin browser request; let it through.
      if (!origin) {
        callback(null, true);
        return;
      }
      allowedOrigins()
        .then((set) => callback(null, set.has(origin)))
        .catch((err: unknown) => callback(err as Error));
    },
  };
}
