import { Injectable } from '@nestjs/common';
// ws is CommonJS: default-import the class (we need the WebSocket.OPEN constant
// and the type). Works under NodeNext thanks to esModuleInterop.
import WebSocket from 'ws';
import type {
  ServerToClientEvent,
  ServerToClientEvents,
} from '@support-widget/shared';

/**
 * In-process registry of live WebSocket connections, grouped into "rooms" by
 * conversationId. It is the single owner of realtime fan-out state, so two very
 * different callers can reach the sockets without depending on each other:
 *
 *   - RealtimeGateway   -> join/leave/cleanup as sockets connect and disconnect;
 *   - MessagesService   -> broadcast `message:created` right after the INSERT.
 *
 * This avoids a circular dependency: the gateway needs MessagesService (to
 * persist), and MessagesService needs to broadcast — if the gateway also owned
 * broadcast, the two would depend on each other. The registry breaks that cycle.
 *
 * v0 keeps everything in this one process's memory. In v2 (multiple API
 * instances) this Map is exactly what gets replaced by Redis Pub/Sub, so a
 * message saved on instance A reaches a socket held by instance B.
 */
@Injectable()
export class RealtimeRegistry {
  // conversationId -> sockets currently watching that conversation.
  private readonly rooms = new Map<string, Set<WebSocket>>();

  /** Add a socket to a conversation's room (creating the room on first join). */
  join(conversationId: string, socket: WebSocket): void {
    let room = this.rooms.get(conversationId);
    if (!room) {
      room = new Set<WebSocket>();
      this.rooms.set(conversationId, room);
    }
    room.add(socket);
  }

  /** Remove a socket from one room; drop the room once it is empty. */
  leave(conversationId: string, socket: WebSocket): void {
    const room = this.rooms.get(conversationId);
    if (!room) return;
    room.delete(socket);
    if (room.size === 0) {
      this.rooms.delete(conversationId);
    }
  }

  /**
   * Remove a socket from every room it joined. Called on disconnect, when we no
   * longer know (or care) which conversations it was in.
   */
  removeFromAll(socket: WebSocket): void {
    for (const [conversationId, room] of this.rooms) {
      if (room.delete(socket) && room.size === 0) {
        this.rooms.delete(conversationId);
      }
    }
  }

  /**
   * Send one server->client event to every socket in a conversation's room.
   *
   * The wire format is the shared `{ event, data }` envelope. The event name and
   * payload are tied together by ServerToClientEvents, so a wrong payload for a
   * given event is a compile error here — the contract is enforced at the edge.
   */
  broadcast<E extends ServerToClientEvent>(
    conversationId: string,
    event: E,
    data: ServerToClientEvents[E],
  ): void {
    const room = this.rooms.get(conversationId);
    if (!room) return;

    const frame = JSON.stringify({ event, data });
    for (const socket of room) {
      // Skip sockets mid-close: sending to them would throw.
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(frame);
      }
    }
  }
}
