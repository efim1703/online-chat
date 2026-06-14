import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import {
  type ClientToServerEvents,
  SenderType,
} from '@support-widget/shared';
import { DatabaseService } from '../database/database.service.js';
import { MessagesService } from '../messages/messages.service.js';
import { RealtimeRegistry } from './realtime-registry.service.js';

/**
 * Кто стоит за сокетом — резолвится один раз из query `?token=` в момент подключения.
 * Событие, которое шлёт клиент (`visitor:*` vs `operator:*`), объявляет его роль; но
 * для senderType/senderId мы доверяем именно этой личности, чтобы посетитель не мог
 * писать как оператор, просто выбрав «операторское» имя события.
 */
type Identity =
  | { kind: 'visitor'; visitorId: string; projectId: string }
  | { kind: 'operator'; userId: string; organizationId: string };

// Сырой сокет `ws` плюс личность, которую мы навешиваем после успешного handshake.
interface AuthedSocket extends WebSocket {
  identity?: Identity;
}

/**
 * Gateway на нативном `ws` (подключается через WsAdapter в main.ts). Он отвечает
 * только за жизненный цикл соединения и маршрутизацию событий — всё состояние
 * рассылки живёт в RealtimeRegistry, а персистентность в MessagesService, поэтому
 * класс остаётся тонким.
 *
 * Протокол обмена: общий JSON-конверт `{ event, data }`. @SubscribeMessage
 * сопоставляется по `event`; хендлеры НЕ возвращают значение в ответ отправителю —
 * вместо этого они вызывают registry.broadcast(...) для рассылки на всю комнату.
 */
@WebSocketGateway()
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly registry: RealtimeRegistry,
    private readonly messages: MessagesService,
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Вызывается ws-адаптером для каждого нового подключения. `request` — это HTTP
   * upgrade-запрос, в его URL лежит `?token=...`. Здесь ещё нет входа в комнату —
   * клиент входит явно через `conversation:join`.
   *
   * Раскомментируй пошагово:
   */
  async handleConnection(
    client: AuthedSocket,
    request: IncomingMessage,
  ): Promise<void> {
    // Шаг 1. Токен лежит в query upgrade-запроса. request.url — это "/?token=...",
    // поэтому даём URL фиктивный base, чтобы распарсить searchParams.
    const url = new URL(request.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token');

    // Шаг 2. Нет токена — закрываем сокет. 4001 — наш код "unauthorized"
    // (диапазон 4000-4999 зарезервирован под коды приложения).
    if (!token) {
      client.close(4001, 'missing token');
      return;
    }

    // Шаг 3. Резолвим личность тем же способом, что HTTP-guard'ы.
    const identity = await this.resolveIdentity(token);

    // Шаг 4. Токен не распознан / истёк — закрываем.
    if (!identity) {
      client.close(4001, 'invalid token');
      return;
    }

    // Шаг 5. Запоминаем, кто за сокетом — HTTP-сессии тут нет, состояние живёт
    // на самом сокете до его закрытия.
    client.identity = identity;
  }

  /**
   * Вызывается при закрытии сокета. Мы не знаем, в каких комнатах он был, поэтому
   * просто удаляем его из всех.
   */
  handleDisconnect(client: AuthedSocket): void {
    this.registry.removeFromAll(client);
  }

  /**
   * client -> server: вход в комнату диалога, чтобы начать получать его события.
   * (v0 доверяет аутентифицированной личности и не перепроверяет владение по каждой
   * комнате — осознанное упрощение v0; HTTP-маршруты по-прежнему это проверяют.)
   */
  @SubscribeMessage('conversation:join')
  onJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: ClientToServerEvents['conversation:join'],
  ): void {
    // Без личности подключения быть не должно (мы закрываем такие в handleConnection),
    // но проверяем на всякий случай.
    if (!client.identity) return;
    this.registry.join(data.conversationId, client);
  }

  /** client -> server: выход из комнаты диалога. */
  @SubscribeMessage('conversation:leave')
  onLeave(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: ClientToServerEvents['conversation:leave'],
  ): void {
    this.registry.leave(data.conversationId, client);
  }

  /**
   * client -> server: посетитель шлёт сообщение по WS. createMessage и сохраняет
   * его, И рассылает `message:created` (v0-4.13), так что комната — включая
   * дашборд оператора — его получает. Возвращать ничего не нужно.
   */
  @SubscribeMessage('visitor:message:create')
  async onVisitorMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: ClientToServerEvents['visitor:message:create'],
  ): Promise<void> {
    // Только посетитель имеет право слать visitor:* — иначе игнорируем.
    if (client.identity?.kind !== 'visitor') return;
    await this.messages.createMessage({
      conversationId: data.conversationId,
      senderType: SenderType.Visitor,
      senderId: client.identity.visitorId,
      body: data.body,
    });
  }

  /**
   * client -> server: оператор отвечает по WS. Зеркало onVisitorMessage.
   */
  @SubscribeMessage('operator:message:create')
  async onOperatorMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: ClientToServerEvents['operator:message:create'],
  ): Promise<void> {
    if (client.identity?.kind !== 'operator') return;
    await this.messages.createMessage({
      conversationId: data.conversationId,
      senderType: SenderType.Operator,
      senderId: client.identity.userId,
      body: data.body,
    });
  }

  /**
   * client -> server: посетитель/оператор начал печатать. Чистый relay — БЕЗ записи
   * в БД (typing эфемерен). Рассылаем `typing:started` по комнате, чтобы другая
   * сторона увидела индикатор.
   */
  @SubscribeMessage('typing:start')
  onTypingStart(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: ClientToServerEvents['typing:start'],
  ): void {
    if (!client.identity) return;
    // Кто печатает — выводим из личности сокета, не доверяя клиенту.
    const senderType =
      client.identity.kind === 'operator'
        ? SenderType.Operator
        : SenderType.Visitor;
    this.registry.broadcast(data.conversationId, 'typing:started', {
      conversationId: data.conversationId,
      senderType,
    });
  }

  /** client -> server: перестал печатать. Зеркало onTypingStart с `typing:stopped`. */
  @SubscribeMessage('typing:stop')
  onTypingStop(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: ClientToServerEvents['typing:stop'],
  ): void {
    if (!client.identity) return;
    const senderType =
      client.identity.kind === 'operator'
        ? SenderType.Operator
        : SenderType.Visitor;
    this.registry.broadcast(data.conversationId, 'typing:stopped', {
      conversationId: data.conversationId,
      senderType,
    });
  }

  /**
   * Резолвит значение `?token=` в личность. Повторяет ровно те же запросы, что и
   * HTTP-guard'ы (WidgetSessionGuard / OperatorGuard): сначала ищем неистёкшую
   * сессию посетителя по SHA-256-хешу, затем откатываемся на dev-токен оператора.
   * Возвращает null, если не подошло ни то, ни другое.
   *
   * (Обвязка — дана готовой, чтобы ты сфокусировался на жизненном цикле сокета.
   * В v1 эта дублированная авторизация унифицируется за настоящим OAuth.)
   */
  private async resolveIdentity(token: string): Promise<Identity | null> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await this.db.query<{
      visitor_id: string;
      project_id: string;
    }>(
      `SELECT visitor_id, project_id
       FROM widget_sessions
       WHERE token_hash = $1 AND expires_at > now()`,
      [tokenHash],
    );
    if (session.rowCount && session.rowCount > 0) {
      return {
        kind: 'visitor',
        visitorId: session.rows[0].visitor_id,
        projectId: session.rows[0].project_id,
      };
    }

    const expected = this.config.getOrThrow<string>('OPERATOR_DEV_TOKEN');
    if (token === expected) {
      const op = await this.db.query<{ id: string; organization_id: string }>(
        `SELECT id, organization_id
         FROM users
         WHERE role = 'operator'
         ORDER BY created_at ASC
         LIMIT 1`,
      );
      if (op.rowCount && op.rowCount > 0) {
        return {
          kind: 'operator',
          userId: op.rows[0].id,
          organizationId: op.rows[0].organization_id,
        };
      }
    }

    return null;
  }
}
