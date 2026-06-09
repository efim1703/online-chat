import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { ConversationDto, MessageDto } from '@support-widget/shared';
import { CreateMessageDto } from '../common/dto.js';
import { OperatorConversationsService } from './operator-conversations.service.js';
import { UpdateConversationDto } from './dto.js';
import { OperatorCtx, OperatorGuard, type OperatorContext } from './operator.guard.js';

/**
 * Operator-facing conversation routes. OperatorGuard validates the dev token
 * (v0-4.9) and injects the OperatorContext (org-scoped). Bodies are validated by
 * the global ValidationPipe against the DTO classes (v0-4.10).
 */
@Controller('operator/conversations')
@UseGuards(OperatorGuard)
export class OperatorConversationsController {
  constructor(private readonly conversations: OperatorConversationsService) {}

  // GET /operator/conversations
  @Get()
  list(@OperatorCtx() ctx: OperatorContext): Promise<ConversationDto[]> {
    return this.conversations.listConversations(ctx);
  }

  // GET /operator/conversations/:id
  @Get(':id')
  get(
    @OperatorCtx() ctx: OperatorContext,
    @Param('id') id: string,
  ): Promise<ConversationDto> {
    return this.conversations.getConversation(ctx, id);
  }

  // POST /operator/conversations/:id/messages
  @Post(':id/messages')
  postMessage(
    @OperatorCtx() ctx: OperatorContext,
    @Param('id') id: string,
    @Body() body: CreateMessageDto,
  ): Promise<MessageDto> {
    return this.conversations.postMessage(ctx, id, body);
  }

  // PATCH /operator/conversations/:id
  @Patch(':id')
  update(
    @OperatorCtx() ctx: OperatorContext,
    @Param('id') id: string,
    @Body() body: UpdateConversationDto,
  ): Promise<ConversationDto> {
    return this.conversations.updateConversation(ctx, id, body);
  }
}
