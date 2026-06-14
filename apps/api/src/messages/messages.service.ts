import { Injectable } from '@nestjs/common';
import type { MessageDto, SenderType } from '@support-widget/shared';
import { DatabaseService } from '../database/database.service.js';
import { RealtimeRegistry } from '../realtime/realtime-registry.service.js';
import { type MessageRow, rowToMessageDto } from '../common/mappers.js';

/** Всё необходимое для сохранения одного сообщения. */
export interface CreateMessageParams {
  conversationId: string;
  senderType: SenderType;
  /** Id посетителя или пользователя; null для `system`-сообщений. */
  senderId: string | null;
  body: string;
}

/**
 * Единственное место, где создаётся строка сообщения — и (v0-4.13) единственное место,
 * где оно рассылается — поэтому каждый вызывающий (HTTP-маршрут виджета, HTTP-маршрут
 * оператора, WS-gateway) получает идентичное поведение persist→fanout без дублирования.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly realtime: RealtimeRegistry,
  ) {}

  async createMessage(params: CreateMessageParams): Promise<MessageDto> {
    const { conversationId, senderType, senderId, body } = params;

    const inserted = await this.db.query<MessageRow>(
      `INSERT INTO messages (conversation_id, sender_type, sender_id, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, conversation_id, sender_type, sender_id, body,
                 created_at, delivered_at, read_at`,
      [conversationId, senderType, senderId, body],
    );

    // Обновляем диалог, чтобы дашборд мог сортировать по последней активности.
    await this.db.query(
      'UPDATE conversations SET updated_at = now() WHERE id = $1',
      [conversationId],
    );

    const message = rowToMessageDto(inserted.rows[0]);

    // v0-4.13: разослать сохранённое сообщение в комнату диалога, чтобы все
    // подключённые клиенты (виджет посетителя + дашборд оператора) получили его
    // в реальном времени. Единое место persist→broadcast для HTTP и WS.
    this.realtime.broadcast(conversationId, 'message:created', message);

    return message;
  }
}
