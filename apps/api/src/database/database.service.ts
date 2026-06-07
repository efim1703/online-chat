import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// pg is CommonJS: default-import the namespace for values, type-only import for types.
import pg from 'pg';
import type { Pool, QueryResult, QueryResultRow } from 'pg';

const { Pool: PgPool } = pg;

/**
 * Single connection pool for the whole process (see DatabaseModule, @Global).
 * Wraps pg.Pool so the rest of the app does DI by class and gets graceful
 * shutdown for free. Raw SQL stays visible — callers pass real query text.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    // Pool is lazy: no socket is opened until the first query runs.
    this.pool = new PgPool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
    });
  }

  /**
   * Run a single SQL statement. The pool checks out a connection, runs the
   * query, and returns it to the pool automatically — ideal for one-off reads
   * and writes. Multi-statement transactions will take a client explicitly
   * (pool.connect()) and live in the service that owns them.
   */
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  // Close all sockets when Nest tears the app down, so the process exits clean.
  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
