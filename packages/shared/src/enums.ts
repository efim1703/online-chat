/**
 * Доменные перечисления, используемые в api, dashboard и widget-sdk.
 *
 * Смоделированы как `const object + literal union` (не нативный TS `enum`):
 *  - значения — обычные строки, идентичные тому, что хранится в TEXT-колонках Postgres;
 *  - никакой магии runtime enum-объекта, tree-shake-friendly, ESM-safe при isolatedModules;
 *  - union-тип и const разделяют одно имя (declaration merging в TS), поэтому
 *    потребители могут использовать `SenderType` и как тип, и как коллекцию значений.
 */

/** Кто написал сообщение. Соответствует колонке `messages.sender_type`. */
export const SenderType = {
  Visitor: 'visitor',
  Operator: 'operator',
  System: 'system',
} as const;
export type SenderType = (typeof SenderType)[keyof typeof SenderType];

/** Жизненный цикл диалога. Соответствует колонке `conversations.status`. */
export const ConversationStatus = {
  /** Создан посетителем, оператор ещё не назначен. */
  Open: 'open',
  /** Оператор взял диалог (`assigned_user_id` установлен). */
  Assigned: 'assigned',
  /** Решён / заархивирован. */
  Closed: 'closed',
} as const;
export type ConversationStatus =
  (typeof ConversationStatus)[keyof typeof ConversationStatus];
