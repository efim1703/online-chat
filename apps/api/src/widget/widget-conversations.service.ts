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
 * Операции с диалогами для посетителей, все ограничены посетителем текущей сессии.
 * Диалоги никогда не ищутся только по id — всегда по (id, visitor_id) —
 * чтобы один посетитель не мог прочитать чужой чат, угадав UUID.
 */
@Injectable()
export class WidgetConversationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly messages: MessagesService,
  ) {}

  /**
   * POST /widget/conversations — переиспользует текущий открытый диалог посетителя,
   * если он есть, иначе создаёт новый. Переиспользование предотвращает накопление
   * пустых `open`-диалогов при каждом повторном открытии виджета.
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

  /** GET /widget/conversations/:id/messages — полная история, от старых к новым. */
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

  /** POST /widget/conversations/:id/messages — сохраняет сообщение посетителя. */
  async postMessage(
    session: WidgetSession,
    conversationId: string,
    input: CreateMessageInput,
  ): Promise<MessageDto> {
    // body уже провалидировано и обрезано через CreateMessageDto в контроллере (v0-4.10).
    await this.assertOwnedByVisitor(session, conversationId);

    return this.messages.createMessage({
      conversationId,
      senderType: SenderType.Visitor,
      senderId: session.visitorId,
      body: input.body,
    });
  }

  /**
   * Защищает каждый маршрут с `:id`: диалог должен существовать И принадлежать
   * посетителю текущей сессии. Некорректный id трактуется как «не найдено», чтобы
   * мусор не попадал в uuid-колонку. Возвращаем 404 (не 403), чтобы не раскрывать,
   * какие id диалогов существуют.
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
