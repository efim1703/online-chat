import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// pg — CommonJS: дефолтный импорт неймспейса для значений, type-only импорт для типов.
import pg from 'pg';
import type { Pool, QueryResult, QueryResultRow } from 'pg';

const { Pool: PgPool } = pg;

/**
 * Единственный пул соединений для всего процесса (см. DatabaseModule, @Global).
 * Оборачивает pg.Pool так, чтобы остальное приложение работало с ним через DI
 * и получало корректное завершение бесплатно. Сырой SQL остаётся видимым — вызывающий
 * код передаёт настоящий текст запроса.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    // Пул ленивый: сокет не открывается до первого запроса.
    this.pool = new PgPool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
    });
  }

  /**
   * Выполняет одиночный SQL-запрос. Пул забирает соединение, выполняет запрос
   * и автоматически возвращает его обратно — идеально для разовых чтений и записей.
   * Многошаговые транзакции берут клиента явно (pool.connect()) и живут
   * в сервисе, который ими владеет.
   */
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  // Закрываем все сокеты при остановке приложения Nest, чтобы процесс завершился корректно.
  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
