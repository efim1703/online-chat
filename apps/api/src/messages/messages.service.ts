import { Injectable } from '@nestjs/common';
import type { MessageDto, SenderType } from '@support-widget/shared';
import { DatabaseService } from '../database/database.service.js';
import { RealtimeRegistry } from '../realtime/realtime-registry.service.js';
import { type MessageRow, rowToMessageDto } from '../common/mappers.js';

/** Everything needed to persist one message. */
export interface CreateMessageParams {
  conversationId: string;
  senderType: SenderType;
  /** Visitor or user id; null for `system` messages. */
  senderId: string | null;
  body: string;
}

/**
 * The single place a message row is created — and (v0-4.13) the single place it
 * is broadcast — so every caller (widget HTTP route, operator HTTP route, the WS
 * gateway) gets identical persist→fanout behaviour with no duplication.
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

    // Bump the conversation so the dashboard can sort by most-recent activity.
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
