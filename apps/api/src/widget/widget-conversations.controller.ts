import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { ConversationDto, MessageDto } from '@support-widget/shared';
import { CreateMessageDto } from '../common/dto.js';
import { WidgetConversationsService } from './widget-conversations.service.js';
import {
  WidgetSessionCtx,
  WidgetSessionGuard,
  type WidgetSession,
} from './widget-session.guard.js';

/**
 * HTTP-маршруты диалогов для посетителей. Guard валидирует Bearer-токен сессии
 * (v0-4.6) и инжектирует WidgetSession. Тела запросов валидируются глобальным
 * ValidationPipe против DTO-классов (v0-4.10).
 */
@Controller('widget/conversations')
@UseGuards(WidgetSessionGuard)
export class WidgetConversationsController {
  constructor(private readonly conversations: WidgetConversationsService) {}

  // POST /widget/conversations
  @Post()
  create(@WidgetSessionCtx() session: WidgetSession): Promise<ConversationDto> {
    return this.conversations.createConversation(session);
  }

  // GET /widget/conversations/:id/messages
  @Get(':id/messages')
  listMessages(
    @WidgetSessionCtx() session: WidgetSession,
    @Param('id') id: string,
  ): Promise<MessageDto[]> {
    return this.conversations.listMessages(session, id);
  }

  // POST /widget/conversations/:id/messages
  @Post(':id/messages')
  postMessage(
    @WidgetSessionCtx() session: WidgetSession,
    @Param('id') id: string,
    @Body() body: CreateMessageDto,
  ): Promise<MessageDto> {
    return this.conversations.postMessage(session, id, body);
  }
}
