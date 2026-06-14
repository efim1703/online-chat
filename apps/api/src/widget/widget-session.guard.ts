import { createHash } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

/** Идентичность, полученная из валидного токена сессии виджета. */
export interface WidgetSession {
  visitorId: string;
  projectId: string;
}

// Минимальная форма запроса, с которой мы работаем — позволяет не зависеть от @types/express.
// Guard читает заголовок Authorization и сохраняет resolved-сессию на объекте запроса.
interface RequestWithSession {
  headers: { authorization?: string };
  widgetSession?: WidgetSession;
}

/**
 * Аутентифицирует HTTP-запросы виджета по токену сессии, выданному в v0-4.6.
 *
 * Виджет отправляет `Authorization: Bearer <token>`. Хешируем токен через
 * SHA-256 и ищем непросроченную строку в widget_sessions (хранится только хеш,
 * никогда не сырой токен). При успехе прикрепляем { visitorId, projectId }
 * к запросу, чтобы контроллеры/сервисы действовали от имени этого посетителя.
 */
@Injectable()
export class WidgetSessionGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithSession>();

    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('missing session token');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const result = await this.db.query<{ visitor_id: string; project_id: string }>(
      `SELECT visitor_id, project_id
       FROM widget_sessions
       WHERE token_hash = $1 AND expires_at > now()`,
      [tokenHash],
    );
    if (result.rowCount === 0) {
      throw new UnauthorizedException('invalid or expired session');
    }

    req.widgetSession = {
      visitorId: result.rows[0].visitor_id,
      projectId: result.rows[0].project_id,
    };
    return true;
  }
}

// Извлекает токен из заголовка «Authorization: Bearer <token>».
function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme !== 'Bearer' || !value) return null;
  return value;
}

/**
 * Инжектирует resolved WidgetSession в параметр хендлера. Используется совместно
 * с WidgetSessionGuard — guard гарантирует его наличие.
 */
export const WidgetSessionCtx = createParamDecorator(
  (_data: unknown, context: ExecutionContext): WidgetSession => {
    const req = context.switchToHttp().getRequest<RequestWithSession>();
    // Non-null: маршруты с этим декоратором всегда защищены WidgetSessionGuard.
    return req.widgetSession!;
  },
);
