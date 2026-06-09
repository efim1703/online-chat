import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service.js';

/** Identity of the authenticated operator and the org they can act within. */
export interface OperatorContext {
  userId: string;
  organizationId: string;
}

// Minimal request shape we touch — avoids depending on @types/express.
interface RequestWithOperator {
  headers: { authorization?: string };
  operator?: OperatorContext;
}

/**
 * Dev-only auth for operator routes (v0). Real auth is Google OAuth in v1.
 *
 * The dashboard sends `Authorization: Bearer <OPERATOR_DEV_TOKEN>` (the same
 * static token configured in .env). We compare it to the env value and, on a
 * match, load THE seeded operator (single `role='operator'` user) and attach its
 * id + organization to the request. Conversations are then scoped to that org.
 *
 * This is deliberately crude: one shared token, one operator. It exists only so
 * the e2e loop works without a login, and is trivial to rip out when v1 lands.
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
    // Plain compare is fine for a v0 dev token; it is not a user secret.
    if (!token || token !== expected) {
      throw new UnauthorizedException('invalid operator token');
    }

    // v0 has exactly one operator (from the seed). Pick the oldest deterministically.
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

// Pull the token out of an "Authorization: Bearer <token>" header.
function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme !== 'Bearer' || !value) return null;
  return value;
}

/**
 * Injects the resolved OperatorContext into a handler param. Always used behind
 * OperatorGuard, which guarantees it is present.
 */
export const OperatorCtx = createParamDecorator(
  (_data: unknown, context: ExecutionContext): OperatorContext => {
    const req = context.switchToHttp().getRequest<RequestWithOperator>();
    // Non-null: routes using this decorator are always behind OperatorGuard.
    return req.operator!;
  },
);
