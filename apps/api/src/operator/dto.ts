import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  ConversationStatus,
  type UpdateConversationInput,
} from '@support-widget/shared';

// Допустимые значения статуса, берутся из общего enum, чтобы они никогда не расходились.
const CONVERSATION_STATUSES = Object.values(ConversationStatus);

/**
 * Валидированное тело запроса для `PATCH /operator/conversations/:id`.
 *
 * Оба поля опциональны (частичное обновление). `assignedUserId` может быть UUID
 * (назначить) или явным `null` (снять назначение). @IsOptional пропускает
 * валидацию при null/undefined, поэтому null проходит (снять назначение),
 * а ненулевое значение должно быть UUID.
 */
export class UpdateConversationDto implements UpdateConversationInput {
  @IsOptional()
  @IsIn(CONVERSATION_STATUSES)
  status?: ConversationStatus;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string | null;
}
