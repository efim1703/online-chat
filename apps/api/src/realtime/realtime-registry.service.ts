import { Injectable } from '@nestjs/common';
// ws — CommonJS: дефолтный импорт класса (нужна константа WebSocket.OPEN и тип).
// Работает под NodeNext благодаря esModuleInterop.
import WebSocket from 'ws';
import type {
  ServerToClientEvent,
  ServerToClientEvents,
} from '@support-widget/shared';

/**
 * Внутрипроцессный реестр активных WebSocket-соединений, сгруппированных по «комнатам»
 * (conversationId). Единственный владелец состояния realtime fan-out, что позволяет
 * двум разным вызывающим добираться до сокетов без зависимости друг от друга:
 *
 *   - RealtimeGateway   -> join/leave/cleanup при подключении и отключении сокетов;
 *   - MessagesService   -> рассылает `message:created` сразу после INSERT.
 *
 * Это позволяет избежать циклической зависимости: gateway нужен MessagesService
 * (для сохранения), а MessagesService нужна рассылка — если бы gateway владел ею,
 * они зависели бы друг от друга. Реестр разрывает этот цикл.
 *
 * v0 хранит всё в памяти одного процесса. В v2 (несколько экземпляров API) именно
 * этот Map заменяется Redis Pub/Sub, чтобы сообщение, сохранённое на instance A,
 * доходило до сокета, удерживаемого instance B.
 */
@Injectable()
export class RealtimeRegistry {
  // conversationId -> сокеты, которые сейчас наблюдают этот диалог.
  private readonly rooms = new Map<string, Set<WebSocket>>();

  /** Добавляет сокет в комнату диалога (создаёт комнату при первом подключении). */
  join(conversationId: string, socket: WebSocket): void {
    let room = this.rooms.get(conversationId);
    if (!room) {
      room = new Set<WebSocket>();
      this.rooms.set(conversationId, room);
    }
    room.add(socket);
  }

  /** Удаляет сокет из комнаты; удаляет комнату, когда она становится пустой. */
  leave(conversationId: string, socket: WebSocket): void {
    const room = this.rooms.get(conversationId);
    if (!room) return;
    room.delete(socket);
    if (room.size === 0) {
      this.rooms.delete(conversationId);
    }
  }

  /**
   * Удаляет сокет из всех комнат, в которые он вошёл. Вызывается при отключении,
   * когда нам уже неизвестно (и неважно), в каких диалогах он находился.
   */
  removeFromAll(socket: WebSocket): void {
    for (const [conversationId, room] of this.rooms) {
      if (room.delete(socket) && room.size === 0) {
        this.rooms.delete(conversationId);
      }
    }
  }

  /**
   * Отправляет одно server→client событие всем сокетам в комнате диалога.
   *
   * Wire-формат — общий конверт `{ event, data }`. Имя события и payload связаны
   * через ServerToClientEvents, поэтому неправильный payload для конкретного события
   * даёт ошибку компиляции — контракт соблюдается на границе.
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
      // Пропускаем сокеты в процессе закрытия: отправка им вызовет исключение.
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(frame);
      }
    }
  }
}
