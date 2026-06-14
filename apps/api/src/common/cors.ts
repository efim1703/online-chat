import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';
import { DatabaseService } from '../database/database.service.js';

// Как долго кешируется набор разрешённых origins до повторного чтения из БД.
// Достаточно короткий, чтобы новый origin подхватывался быстро после re-seed,
// и достаточно длинный, чтобы пакетные запросы не долбили Postgres на каждый CORS-preflight.
const ORIGINS_CACHE_TTL_MS = 30_000;

/**
 * Формирует CORS-конфигурацию для всего приложения (v0-4.10).
 *
 * Браузер проверяет CORS по заголовкам ответа на каждый запрос, но проверка origin
 * происходит до маршрутизации, поэтому контекст проекта здесь недоступен. Прагматичное
 * правило v0: разрешить origin, если это origin дашборда ИЛИ он присутствует в
 * `allowed_origins` ЛЮБОГО проекта (объединение). Для одного сидированного проекта это
 * ровно «демо-сайт + дашборд»; при росте числа проектов правило остаётся корректным.
 *
 * Объединение кешируется с коротким TTL, чтобы не запрашивать Postgres на каждый preflight.
 * Запросы без заголовка Origin (curl, same-origin, server-to-server) пропускаются —
 * CORS регулирует только кросс-доменные вызовы из браузера.
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
    // unnest разворачивает TEXT[]-массив allowed_origins каждого проекта в строки.
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
      // Нет заголовка Origin — не кросс-доменный запрос браузера; пропускаем.
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
