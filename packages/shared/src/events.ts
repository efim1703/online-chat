/**
 * WebSocket-контракт — единственный источник правды для realtime-протокола.
 *
 * Wire-формат — JSON-конверт `{ event, data }`. Имена событий зафиксированы
 * в design-doc (support_widget_system_design_plan.md → «WebSocket events»).
 *
 * Контракт выражен двумя типизированными event-картами (имя → payload). Из них
 * выводятся discriminated-union типы конвертов, так что потребители получают:
 *  - прямой lookup имя→payload для типизированных send/emit-хелперов;
 *  - union для `switch (msg.event)` при получении сообщений.
 */

import type { ConversationDto, MessageDto } from './dto.js';
import type { SenderType } from './enums.js';

/** Сообщения, которые клиент (виджет или дашборд) отправляет серверу. */
export interface ClientToServerEvents {
  'conversation:join': { conversationId: string };
  'conversation:leave': { conversationId: string };
  'visitor:message:create': { conversationId: string; body: string };
  'operator:message:create': { conversationId: string; body: string };
  'typing:start': { conversationId: string };
  'typing:stop': { conversationId: string };
}

/** Сообщения, которые сервер рассылает клиентам. */
export interface ServerToClientEvents {
  'message:created': MessageDto;
  'message:delivered': {
    conversationId: string;
    messageId: string;
    deliveredAt: string;
  };
  'message:read': {
    conversationId: string;
    messageId: string;
    readAt: string;
  };
  'conversation:updated': ConversationDto;
  'typing:started': { conversationId: string; senderType: SenderType };
  'typing:stopped': { conversationId: string; senderType: SenderType };
}

/** Union допустимых имён событий client→server / server→client. */
export type ClientToServerEvent = keyof ClientToServerEvents;
export type ServerToClientEvent = keyof ServerToClientEvents;

/** Обобщённый wire-конверт: `{ event, data }`. */
export interface WsEnvelope<Event extends string, Data> {
  event: Event;
  data: Data;
}

/**
 * Discriminated union всех client→server конвертов, выведенный из карты.
 * Позволяет gateway сужать `data` через `switch (msg.event)`.
 */
export type WsClientMessage = {
  [Event in ClientToServerEvent]: WsEnvelope<Event, ClientToServerEvents[Event]>;
}[ClientToServerEvent];

/** Discriminated union всех server→client конвертов, выведенный из карты. */
export type WsServerMessage = {
  [Event in ServerToClientEvent]: WsEnvelope<Event, ServerToClientEvents[Event]>;
}[ServerToClientEvent];
