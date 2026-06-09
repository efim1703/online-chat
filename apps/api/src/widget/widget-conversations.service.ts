import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type ConversationDto,
  type CreateMessageInput,
  type MessageDto,
  SenderType,
} from '@support-widget/shared';
import { DatabaseService } from '../database/database.service.js';
import { MessagesService } from '../messages/messages.service.js';
import {
  CONVERSATION_COLUMNS,
  MESSAGE_COLUMNS,
  type ConversationRow,
  type MessageRow,
  rowToConversationDto,
  rowToMessageDto,
} from '../common/mappers.js';
import { isUuid } from '../common/uuid.js';
import type { WidgetSession } from './widget-session.guard.js';

/**
 * Visitor-facing conversation operations, all scoped to the session's visitor.
 * Conversations are never looked up by id alone — always by (id, visitor_id) —
 * so one visitor can't read another's chat just by guessing a UUID.
 */
@Injectable()
export class WidgetConversationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly messages: MessagesService,
  ) {}

  /**
   * POST /widget/conversations — reuse the visitor's current open conversation
   * if there is one, otherwise create a fresh one. Reusing avoids piling up
   * empty `open` conversations every time the widget re-opens.
   */
  async createConversation(session: WidgetSession): Promise<ConversationDto> {
    const open = await this.db.query<ConversationRow>(
      `SELECT ${CONVERSATION_COLUMNS}
       FROM conversations
       WHERE visitor_id = $1 AND project_id = $2 AND status <> 'closed'
       ORDER BY created_at DESC
       LIMIT 1`,
      [session.visitorId, session.projectId],
    );
    if (open.rowCount && open.rowCount > 0) {
      return rowToConversationDto(open.rows[0]);
    }

    const created = await this.db.query<ConversationRow>(
      `INSERT INTO conversations (project_id, visitor_id)
       VALUES ($1, $2)
       RETURNING ${CONVERSATION_COLUMNS}`,
      [session.projectId, session.visitorId],
    );
    return rowToConversationDto(created.rows[0]);
  }

  /** GET /widget/conversations/:id/messages — full history, oldest first. */
  async listMessages(
    session: WidgetSession,
    conversationId: string,
  ): Promise<MessageDto[]> {
    await this.assertOwnedByVisitor(session, conversationId);

    const result = await this.db.query<MessageRow>(
      `SELECT ${MESSAGE_COLUMNS}
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId],
    );
    return result.rows.map(rowToMessageDto);
  }

  /** POST /widget/conversations/:id/messages — persist a visitor message. */
  async postMessage(
    session: WidgetSession,
    conversationId: string,
    input: CreateMessageInput,
  ): Promise<MessageDto> {
    // body is validated/trimmed by CreateMessageDto at the controller (v0-4.10).
    await this.assertOwnedByVisitor(session, conversationId);

    return this.messages.createMessage({
      conversationId,
      senderType: SenderType.Visitor,
      senderId: session.visitorId,
      body: input.body,
    });
  }

  /**
   * Guards every `:id` route: the conversation must exist AND belong to the
   * session's visitor. A malformed id is treated as "not found" so junk never
   * reaches the uuid column. We return 404 (not 403) to avoid revealing which
   * conversation ids exist.
   */
  private async assertOwnedByVisitor(
    session: WidgetSession,
    conversationId: string,
  ): Promise<void> {
    if (!isUuid(conversationId)) {
      throw new NotFoundException('conversation not found');
    }
    const owned = await this.db.query(
      'SELECT 1 FROM conversations WHERE id = $1 AND visitor_id = $2',
      [conversationId, session.visitorId],
    );
    if (owned.rowCount === 0) {
      throw new NotFoundException('conversation not found');
    }
  }
}
