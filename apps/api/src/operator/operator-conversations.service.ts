import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type ConversationDto,
  type CreateMessageInput,
  type MessageDto,
  SenderType,
  type UpdateConversationInput,
} from '@support-widget/shared';
import { DatabaseService } from '../database/database.service.js';
import { MessagesService } from '../messages/messages.service.js';
import {
  CONVERSATION_COLUMNS,
  type ConversationRow,
  rowToConversationDto,
} from '../common/mappers.js';
import { isUuid } from '../common/uuid.js';
import type { OperatorContext } from './operator.guard.js';

/**
 * Операции с диалогами для операторов. Всё ограничено организацией оператора:
 * диалог принадлежит проекту, проект — организации, поэтому мы всегда делаем JOIN
 * с `projects` и фильтруем по organization_id. Оператор никогда не сможет
 * обратиться к диалогу другой организации, даже угадав UUID.
 */
@Injectable()
export class OperatorConversationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly messages: MessagesService,
  ) {}

  /** GET /operator/conversations — входящие, отсортированные по последней активности. */
  async listConversations(ctx: OperatorContext): Promise<ConversationDto[]> {
    const result = await this.db.query<ConversationRow>(
      `SELECT ${prefixed(CONVERSATION_COLUMNS, 'c')}
       FROM conversations c
       JOIN projects p ON p.id = c.project_id
       WHERE p.organization_id = $1
       ORDER BY c.updated_at DESC`,
      [ctx.organizationId],
    );
    return result.rows.map(rowToConversationDto);
  }

  /** GET /operator/conversations/:id — один диалог в рамках организации оператора. */
  async getConversation(
    ctx: OperatorContext,
    conversationId: string,
  ): Promise<ConversationDto> {
    const row = await this.findInOrg(ctx, conversationId);
    return rowToConversationDto(row);
  }

  /** POST /operator/conversations/:id/messages — сохраняет ответ оператора. */
  async postMessage(
    ctx: OperatorContext,
    conversationId: string,
    input: CreateMessageInput,
  ): Promise<MessageDto> {
    await this.findInOrg(ctx, conversationId);
    // body уже провалидировано и обрезано через CreateMessageDto на уровне контроллера.
    return this.messages.createMessage({
      conversationId,
      senderType: SenderType.Operator,
      senderId: ctx.userId,
      body: input.body,
    });
  }

  /**
   * PATCH /operator/conversations/:id — частичное обновление статуса и/или исполнителя.
   *
   * SET-клаузула строится динамически из переданных полей, так что оператор может
   * изменить статус, (снять) назначение или и то и другое в одном вызове.
   * Пустой PATCH — ошибка клиента (400), а не no-op, который стоит скрывать.
   */
  async updateConversation(
    ctx: OperatorContext,
    conversationId: string,
    input: UpdateConversationInput,
  ): Promise<ConversationDto> {
    await this.findInOrg(ctx, conversationId);

    const sets: string[] = [];
    const params: unknown[] = [];

    if (input.status !== undefined) {
      params.push(input.status);
      sets.push(`status = $${params.length}`);
    }
    if (input.assignedUserId !== undefined) {
      params.push(input.assignedUserId); // может быть null = снять назначение
      sets.push(`assigned_user_id = $${params.length}`);
    }
    if (sets.length === 0) {
      throw new BadRequestException('nothing to update');
    }

    // Всегда обновляем updated_at, чтобы inbox пересортировался при любом изменении.
    params.push(conversationId);
    const updated = await this.db.query<ConversationRow>(
      `UPDATE conversations
       SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${params.length}
       RETURNING ${CONVERSATION_COLUMNS}`,
      params,
    );
    return rowToConversationDto(updated.rows[0]);
  }

  /**
   * Загружает диалог и проверяет, что он принадлежит организации оператора.
   * Некорректный id → 404 (мусор не попадёт в uuid-колонку); неизвестный
   * или чужой id → 404 (не раскрываем, какие диалоги существуют в других организациях).
   */
  private async findInOrg(
    ctx: OperatorContext,
    conversationId: string,
  ): Promise<ConversationRow> {
    if (!isUuid(conversationId)) {
      throw new NotFoundException('conversation not found');
    }
    const result = await this.db.query<ConversationRow>(
      `SELECT ${prefixed(CONVERSATION_COLUMNS, 'c')}
       FROM conversations c
       JOIN projects p ON p.id = c.project_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [conversationId, ctx.organizationId],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException('conversation not found');
    }
    return result.rows[0];
  }
}

// Добавляет псевдоним таблицы к comma-separated списку колонок, чтобы JOIN-запрос
// (conversations c JOIN projects p) выбирал однозначные c.*-колонки и при этом
// возвращал ровно ту форму, которую ожидает rowToConversationDto.
function prefixed(columns: string, alias: string): string {
  return columns
    .split(',')
    .map((col) => `${alias}.${col.trim()}`)
    .join(', ');
}
