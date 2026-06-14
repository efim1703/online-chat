import { randomBytes, createHash } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CreateSessionInput, WidgetSessionDto } from '@support-widget/shared';
import { DatabaseService } from '../database/database.service.js';
import { isUuid } from '../common/uuid.js';

// Срок жизни токена сессии посетителя. 7 дней достаточно для локального e2e-цикла;
// сессии дёшево перевыдать (виджет просто снова вызывает /session).
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Выдаёт анонимные токены сессии посетителя для встраиваемого виджета.
 *
 * Флоу POST /widget/session (определён в v0-4.6):
 *   1. проверяем, что в теле есть publicKey;
 *   2. резолвим проект по public_key (неизвестный ключ → 401);
 *   3. находим или создаём посетителя:
 *        - если body.visitorId указан И принадлежит этому проекту → переиспользуем
 *          (возвращающийся посетитель сохраняет историю),
 *        - иначе создаём нового анонимного посетителя;
 *   4. генерируем случайный непрозрачный токен, сохраняем ТОЛЬКО его SHA-256-хеш
 *      в widget_sessions вместе с expires_at;
 *   5. возвращаем СЫРОЙ токен единожды (сервер больше не сможет его воспроизвести).
 *
 * Почему непрозрачный + хешированный (не JWT): токен можно отозвать (удалить строку),
 * а утечка БД не раскроет активные сессии — только хеши. SHA-256 (не bcrypt) здесь
 * уместен, потому что токен уже содержит 256 бит энтропии — можно индексировать
 * token_hash и искать сессии напрямую (см. idx_widget_sessions).
 */
@Injectable()
export class WidgetSessionService {
  constructor(private readonly db: DatabaseService) {}

  async createSession(input: CreateSessionInput): Promise<WidgetSessionDto> {
    // Наличие и форма publicKey проверяются через CreateSessionDto + глобальный pipe (v0-4.10).
    // Резолвим проект по public key. Неизвестный ключ — ошибка аутентификации,
    // а не 404: мы не хотим подтверждать, какие ключи существуют.
    const project = await this.db.query<{ id: string }>(
      'SELECT id FROM projects WHERE public_key = $1',
      [input.publicKey],
    );
    if (project.rowCount === 0) {
      throw new UnauthorizedException('unknown public key');
    }
    const projectId = project.rows[0].id;

    // Переиспользуем возвращающегося посетителя, если возможно, иначе создаём нового.
    const visitorId = await this.resolveVisitor(projectId, input.visitorId);

    // Выдаём непрозрачный токен: сырое значение уходит клиенту ровно один раз,
    // персистируется только его SHA-256-хеш (см. doc-комментарий класса для объяснения).
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.db.query(
      `INSERT INTO widget_sessions (project_id, visitor_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [projectId, visitorId, tokenHash, expiresAt],
    );

    return { token, visitorId, projectId, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Возвращает id посетителя, к которому нужно привязать сессию.
   *
   * Переиспользует `requestedId` только если это корректный UUID, принадлежащий
   * этому проекту; всё остальное (некорректный, чужой или отсутствующий) сводится
   * к созданию нового анонимного посетителя. Форма UUID проверяется в JS первой,
   * чтобы мусор не попадал в колонку `uuid` (что вызвало бы ошибку Postgres).
   */
  private async resolveVisitor(
    projectId: string,
    requestedId?: string,
  ): Promise<string> {
    if (isUuid(requestedId)) {
      const existing = await this.db.query<{ id: string }>(
        'SELECT id FROM visitors WHERE id = $1 AND project_id = $2',
        [requestedId, projectId],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        return existing.rows[0].id;
      }
    }

    const created = await this.db.query<{ id: string }>(
      'INSERT INTO visitors (project_id) VALUES ($1) RETURNING id',
      [projectId],
    );
    return created.rows[0].id;
  }
}
