import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import type { CreateSessionInput } from '@support-widget/shared';

/**
 * Валидированное тело запроса для `POST /widget/session`.
 *
 * `publicKey` обязателен (идентифицирует проект). `visitorId` опционален —
 * возвращающийся виджет отправляет id, сохранённый в прошлый раз; если он
 * отсутствует или не является UUID, сервис создаёт нового анонимного посетителя
 * (см. WidgetSessionService).
 */
export class CreateSessionDto implements CreateSessionInput {
  @IsString()
  @IsNotEmpty()
  publicKey!: string;

  @IsOptional()
  @IsUUID()
  visitorId?: string;
}
