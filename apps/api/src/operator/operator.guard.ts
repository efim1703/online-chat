import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service.js';

/** Идентичность аутентифицированного оператора и организации, в рамках которой он действует. */
export interface OperatorContext {
  userId: string;
  organizationId: string;
}

// Минимальная форма запроса, с которой мы работаем — позволяет не зависеть от @types/express.
interface RequestWithOperator {
  headers: { authorization?: string };
  operator?: OperatorContext;
}

/**
 * Dev-авторизация для маршрутов оператора (v0). Настоящая авторизация — Google OAuth в v1.
 *
 * Дашборд отправляет `Authorization: Bearer <OPERATOR_DEV_TOKEN>` (статичный токен
 * из .env). Мы сравниваем его с переменной окружения и при совпадении загружаем
 * единственного сидированного оператора (user с `role='operator'`), прикрепляя его
 * id + организацию к запросу. Диалоги затем ограничиваются этой организацией.
 *
 * Намеренно грубо: один общий токен, один оператор. Существует только для того,
 * чтобы e2e-цикл работал без логина; тривиально удалить при появлении v1.
 */
@Injectable()
export class OperatorGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithOperator>();

    const token = extractBearerToken(req.headers.authorization);
    const expected = this.config.getOrThrow<string>('OPERATOR_DEV_TOKEN');
    // Прямое сравнение нормально для dev-токена v0 — это не пользовательский секрет.
    if (!token || token !== expected) {
      throw new UnauthorizedException('invalid operator token');
    }

    // В v0 ровно один оператор (из сида). Берём самого старого детерминированно.
    const result = await this.db.query<{ id: string; organization_id: string }>(
      `SELECT id, organization_id
       FROM users
       WHERE role = 'operator'
       ORDER BY created_at ASC
       LIMIT 1`,
    );
    if (result.rowCount === 0) {
      throw new UnauthorizedException('no operator user (run pnpm seed)');
    }

    req.operator = {
      userId: result.rows[0].id,
      organizationId: result.rows[0].organization_id,
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
 * Инжектирует resolved OperatorContext в параметр хендлера. Всегда используется
 * за OperatorGuard, который гарантирует его наличие.
 */
export const OperatorCtx = createParamDecorator(
  (_data: unknown, context: ExecutionContext): OperatorContext => {
    const req = context.switchToHttp().getRequest<RequestWithOperator>();
    // Non-null: маршруты с этим декоратором всегда защищены OperatorGuard.
    return req.operator!;
  },
);
