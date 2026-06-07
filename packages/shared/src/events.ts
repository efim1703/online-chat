/**
 * WebSocket contract — the single source of truth for the realtime protocol.
 *
 * Wire format is a JSON envelope `{ event, data }`. Event names are fixed by the
 * design doc (support_widget_system_design_plan.md → "WebSocket events").
 *
 * The contract is expressed as two typed event maps (name -> payload). From them
 * we derive the discriminated-union envelope types, so consumers get both:
 *  - a direct name->payload lookup for typed send/emit helpers, and
 *  - a union to `switch (msg.event)` on when receiving.
 */

import type { ConversationDto, MessageDto } from './dto.js';
import type { SenderType } from './enums.js';

/** Messages a client (widget or dashboard) sends to the server. */
export interface ClientToServerEvents {
  'conversation:join': { conversationId: string };
  'conversation:leave': { conversationId: string };
  'visitor:message:create': { conversationId: string; body: string };
  'operator:message:create': { conversationId: string; body: string };
  'typing:start': { conversationId: string };
  'typing:stop': { conversationId: string };
}

/** Messages the server broadcasts to clients. */
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

/** Union of valid client->server / server->client event names. */
export type ClientToServerEvent = keyof ClientToServerEvents;
export type ServerToClientEvent = keyof ServerToClientEvents;

/** Generic wire envelope: `{ event, data }`. */
export interface WsEnvelope<Event extends string, Data> {
  event: Event;
  data: Data;
}

/**
 * Discriminated union of every client->server envelope, derived from the map.
 * Lets the gateway narrow `data` by `switch (msg.event)`.
 */
export type WsClientMessage = {
  [Event in ClientToServerEvent]: WsEnvelope<Event, ClientToServerEvents[Event]>;
}[ClientToServerEvent];

/** Discriminated union of every server->client envelope, derived from the map. */
export type WsServerMessage = {
  [Event in ServerToClientEvent]: WsEnvelope<Event, ServerToClientEvents[Event]>;
}[ServerToClientEvent];
