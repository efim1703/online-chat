/**
 * Data Transfer Objects — JSON-формы, передающиеся по HTTP и WebSocket.
 *
 * Отражают строки БД (см. DDL в support_widget_system_design_plan.md),
 * но в виде API:
 *  - camelCase имена полей (БД использует snake_case);
 *  - временны́е метки — ISO-8601 строки (в JSON нет типа Date);
 *  - `null` для отсутствующих nullable-колонок.
 */

import type { ConversationStatus, SenderType } from './enums.js';

/** Одно сообщение чата. Отражает строку в таблице `messages`. */
export interface MessageDto {
  id: string;
  conversationId: string;
  senderType: SenderType;
  /** Id посетителя или пользователя; `null` для `system`-сообщений. */
  senderId: string | null;
  body: string;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
}

/** Диалог между посетителем и (опционально) оператором. Отражает таблицу `conversations`. */
export interface ConversationDto {
  id: string;
  projectId: string;
  visitorId: string;
  assignedUserId: string | null;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
}

/** Конечный пользователь виджета. Отражает таблицу `visitors`. */
export interface VisitorDto {
  id: string;
  projectId: string;
  externalId: string | null;
  anonymousName: string | null;
  createdAt: string;
}

/** Тело запроса для создания сообщения (id диалога берётся из маршрута / WS-payload). */
export interface CreateMessageInput {
  body: string;
}

/**
 * Тело запроса для `PATCH /operator/conversations/:id` — частичное обновление диалога.
 *
 * Оба поля опциональны; оператор отправляет только то, что меняет:
 *  - `status` продвигает диалог по жизненному циклу (open/assigned/closed);
 *  - `assignedUserId` берёт или освобождает диалог (`null` = снять назначение).
 */
export interface UpdateConversationInput {
  status?: ConversationStatus;
  assignedUserId?: string | null;
}

/**
 * Тело запроса для `POST /widget/session`.
 *
 * `publicKey` идентифицирует проект (соответствует `projects.public_key`).
 * `visitorId` опционален: виджет сохраняет id, полученный в прошлый раз, в
 * localStorage и передаёт его здесь, чтобы возвращающийся посетитель сохранял
 * историю. Если он отсутствует или не принадлежит проекту, API создаёт нового
 * анонимного посетителя.
 */
export interface CreateSessionInput {
  publicKey: string;
  visitorId?: string;
}

/**
 * Ответ на `POST /widget/session`.
 *
 * `token` — сырой непрозрачный токен сессии, возвращается клиенту ровно один раз.
 * Сервер хранит только его хеш (см. `widget_sessions.token_hash`), поэтому больше
 * никогда не сможет вернуть токен повторно. Виджет сохраняет `visitorId`, чтобы
 * передать его при следующей сессии (см. CreateSessionInput).
 */
export interface WidgetSessionDto {
  token: string;
  visitorId: string;
  projectId: string;
  /** Время истечения токена сессии в формате ISO-8601. */
  expiresAt: string;
}
