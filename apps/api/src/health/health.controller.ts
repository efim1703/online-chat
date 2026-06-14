import { Controller, Get } from '@nestjs/common';

/**
 * Liveness probe. Дёшево добавить сейчас; балансировщики / оркестраторы в v2+
 * будут его опрашивать. Намеренно НЕ трогает БД — отвечает на вопрос «процесс жив?»,
 * а не «все зависимости здоровы?» (более глубокая readiness-проверка может появиться позже).
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
