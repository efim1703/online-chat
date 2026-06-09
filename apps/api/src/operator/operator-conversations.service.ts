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
 * Operator-facing conversation operations. Everything is scoped to the
 * operator's organization: a conversation belongs to a project, a project to an
 * organization, so we always join `projects` and filter by organization_id. An
 * operator can never touch a conversation from another org, even by guessing a UUID.
 */
@Injectable()
export class OperatorConversationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly messages: MessagesService,
  ) {}

  /** GET /operator/conversations — inbox, most recently active first. */
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

  /** GET /operator/conversations/:id — single conversation in the operator's org. */
  async getConversation(
    ctx: OperatorContext,
    conversationId: string,
  ): Promise<ConversationDto> {
    const row = await this.findInOrg(ctx, conversationId);
    return rowToConversationDto(row);
  }

  /** POST /operator/conversations/:id/messages — persist an operator reply. */
  async postMessage(
    ctx: OperatorContext,
    conversationId: string,
    input: CreateMessageInput,
  ): Promise<MessageDto> {
    await this.findInOrg(ctx, conversationId);
    // body is already validated/trimmed by CreateMessageDto at the controller.
    return this.messages.createMessage({
      conversationId,
      senderType: SenderType.Operator,
      senderId: ctx.userId,
      body: input.body,
    });
  }

  /**
   * PATCH /operator/conversations/:id — partial update of status and/or assignee.
   *
   * Builds the SET clause dynamically from whichever fields are present, so the
   * operator can change status, (un)assign, or both in one call. Touching nothing
   * is a 400 — an empty PATCH is a client mistake, not a no-op we want to hide.
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
      params.push(input.assignedUserId); // may be null = unassign
      sets.push(`assigned_user_id = $${params.length}`);
    }
    if (sets.length === 0) {
      throw new BadRequestException('nothing to update');
    }

    // Always bump updated_at so the inbox re-sorts on any change.
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
   * Loads a conversation and asserts it belongs to the operator's organization.
   * Malformed id -> 404 (so junk never reaches the uuid column); unknown or
   * foreign-org id -> 404 (we don't reveal which conversations exist elsewhere).
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

// Qualify a comma-separated column list with a table alias, so a JOIN query
// (conversations c JOIN projects p) selects unambiguous c.* columns while still
// returning the exact shape rowToConversationDto expects.
function prefixed(columns: string, alias: string): string {
  return columns
    .split(',')
    .map((col) => `${alias}.${col.trim()}`)
    .join(', ');
}
