import { randomBytes, createHash } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CreateSessionInput, WidgetSessionDto } from '@support-widget/shared';
import { DatabaseService } from '../database/database.service.js';
import { isUuid } from '../common/uuid.js';

// How long a visitor session token stays valid. 7 days is plenty for the local
// e2e loop; sessions are cheap to re-issue (the widget just calls /session again).
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Issues anonymous visitor session tokens for the embedded widget.
 *
 * Flow of POST /widget/session (decided in v0-4.6):
 *   1. validate the body has a publicKey;
 *   2. resolve the project by public_key (unknown key -> 401);
 *   3. find-or-create the visitor:
 *        - if body.visitorId is given AND belongs to this project -> reuse it
 *          (returning visitor keeps history),
 *        - otherwise create a fresh anonymous visitor;
 *   4. generate a random opaque token, store ONLY its SHA-256 hash in
 *      widget_sessions, with an expires_at;
 *   5. return the RAW token once (the server can never reproduce it).
 *
 * Why opaque + hashed (not JWT): the token can be revoked (delete the row) and a
 * DB leak does not expose live sessions — only hashes. SHA-256 (not bcrypt) is
 * right here because the token is already 256 bits of entropy, so we can index
 * token_hash and look sessions up directly (see idx_widget_sessions).
 */
@Injectable()
export class WidgetSessionService {
  constructor(private readonly db: DatabaseService) {}

  async createSession(input: CreateSessionInput): Promise<WidgetSessionDto> {
    // publicKey presence/shape is enforced by CreateSessionDto + global pipe (v0-4.10).
    // Resolve the project by its public key. An unknown key is an auth failure,
    // not a 404: we don't want to confirm which keys exist.
    const project = await this.db.query<{ id: string }>(
      'SELECT id FROM projects WHERE public_key = $1',
      [input.publicKey],
    );
    if (project.rowCount === 0) {
      throw new UnauthorizedException('unknown public key');
    }
    const projectId = project.rows[0].id;

    // Reuse the returning visitor when possible, otherwise create a fresh one.
    const visitorId = await this.resolveVisitor(projectId, input.visitorId);

    // Issue an opaque token: the raw value goes to the client exactly once,
    // only its SHA-256 hash is persisted (see class doc for the why).
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
   * Returns the visitor id to attach the session to.
   *
   * Reuses `requestedId` only when it is a well-formed UUID that belongs to this
   * project; anything else (malformed, foreign, or missing) falls through to a
   * brand-new anonymous visitor. The UUID shape is checked in JS first so a junk
   * value never reaches the `uuid` column (which would raise a Postgres error).
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
