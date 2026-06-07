import { Injectable } from '@nestjs/common';
import type { MessageDto, SenderType } from '@support-widget/shared';
import { DatabaseService } from '../database/database.service.js';
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
 * Owns message persistence — the single place a message row is created, shared
 * by widget and operator HTTP routes.
 *
 * v0-4.7: persist only. v0-4.13 will extend createMessage to also broadcast
 * `message:created` over WebSocket, so both HTTP and the gateway go through here
 * and the persist→fanout logic is never duplicated.
 */
@Injectable()
export class MessagesService {
  constructor(private readonly db: DatabaseService) {}

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

    return rowToMessageDto(inserted.rows[0]);
  }
}
