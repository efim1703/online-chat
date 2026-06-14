import { Body, Controller, Post } from '@nestjs/common';
import type { WidgetSessionDto } from '@support-widget/shared';
import { WidgetSessionService } from './widget-session.service.js';
import { CreateSessionDto } from './dto.js';

/**
 * Публичный HTTP API для виджета (без авторизации оператора — вызывается встроенным
 * widget.js на странице посетителя). CORS по allowed_origins применяется глобально
 * (см. buildCorsOptions).
 */
@Controller('widget')
export class WidgetController {
  constructor(private readonly sessions: WidgetSessionService) {}

  // POST /widget/session — обменивает public_key проекта на токен посетителя.
  // Тело валидируется глобальным ValidationPipe против CreateSessionDto.
  @Post('session')
  createSession(@Body() body: CreateSessionDto): Promise<WidgetSessionDto> {
    return this.sessions.createSession(body);
  }
}
