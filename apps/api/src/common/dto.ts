import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CreateMessageInput } from '@support-widget/shared';

/**
 * Валидированное тело запроса для маршрутов создания сообщения (виджет и оператор).
 *
 * `implements CreateMessageInput` привязывает класс к общему wire-контракту —
 * если интерфейс получит новое поле, компиляция упадёт до тех пор, пока мы его не добавим.
 * Тело обрезается (чтобы " " отклонялся, а не сохранялся) и должно быть непустым.
 */
export class CreateMessageDto implements CreateMessageInput {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  body!: string;
}
