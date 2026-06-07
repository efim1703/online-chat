import { createHash } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

/** Identity resolved from a valid widget session token. */
export interface WidgetSession {
  visitorId: string;
  projectId: string;
}

// Minimal request shape we touch — avoids depending on @types/express. The guard
// reads the Authorization header and stashes the resolved session on the request.
interface RequestWithSession {
  headers: { authorization?: string };
  widgetSession?: WidgetSession;
}

/**
 * Authenticates widget HTTP calls by the session token issued in v0-4.6.
 *
 * The widget sends `Authorization: Bearer <token>`. We hash the token with
 * SHA-256 and look up a non-expired row in widget_sessions (the stored value is
 * the hash, never the raw token). On success we attach { visitorId, projectId }
 * to the request so controllers/services act on behalf of that visitor.
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

// Pull the token out of an "Authorization: Bearer <token>" header.
function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme !== 'Bearer' || !value) return null;
  return value;
}

/**
 * Injects the resolved WidgetSession into a handler param. Used together with
 * WidgetSessionGuard — the guard guarantees it is present.
 */
export const WidgetSessionCtx = createParamDecorator(
  (_data: unknown, context: ExecutionContext): WidgetSession => {
    const req = context.switchToHttp().getRequest<RequestWithSession>();
    // Non-null: routes using this decorator are always behind WidgetSessionGuard.
    return req.widgetSession!;
  },
);
