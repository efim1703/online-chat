/**
 * Data Transfer Objects — the JSON shapes that travel over HTTP and WebSocket.
 *
 * These mirror the DB rows (see the DDL in support_widget_system_design_plan.md)
 * but in API form:
 *  - camelCase field names (DB uses snake_case);
 *  - timestamps are ISO-8601 strings (JSON has no Date type);
 *  - `null` for absent nullable columns.
 */

import type { ConversationStatus, SenderType } from './enums.js';

/** A single chat message. Mirrors a row in `messages`. */
export interface MessageDto {
  id: string;
  conversationId: string;
  senderType: SenderType;
  /** Visitor or user id; `null` for `system` messages. */
  senderId: string | null;
  body: string;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
}

/** A conversation between a visitor and (optionally) an operator. Mirrors `conversations`. */
export interface ConversationDto {
  id: string;
  projectId: string;
  visitorId: string;
  assignedUserId: string | null;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
}

/** A widget end-user. Mirrors `visitors`. */
export interface VisitorDto {
  id: string;
  projectId: string;
  externalId: string | null;
  anonymousName: string | null;
  createdAt: string;
}

/** Body for creating a message (the conversation id comes from the route / WS payload). */
export interface CreateMessageInput {
  body: string;
}

/**
 * Body for `POST /widget/session`.
 *
 * `publicKey` identifies the project (maps to `projects.public_key`).
 * `visitorId` is optional: the widget persists the id it got last time in
 * localStorage and replays it here so a returning visitor keeps their history.
 * If it is missing or does not belong to the project, the API creates a fresh
 * anonymous visitor.
 */
export interface CreateSessionInput {
  publicKey: string;
  visitorId?: string;
}

/**
 * Response of `POST /widget/session`.
 *
 * `token` is the raw, opaque session token — returned to the client exactly
 * once. The server stores only its hash (see `widget_sessions.token_hash`), so
 * it can never hand the token back again. The widget keeps `visitorId` to
 * replay on the next session (see CreateSessionInput).
 */
export interface WidgetSessionDto {
  token: string;
  visitorId: string;
  projectId: string;
  /** ISO-8601 expiry of the session token. */
  expiresAt: string;
}
