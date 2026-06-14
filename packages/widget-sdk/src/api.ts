/**
 * Тонкая обёртка над HTTP API виджета. Только то, что нужно посетителю:
 * получить сессию, открыть диалог и подтянуть историю. Отправка сообщений
 * идёт по WebSocket (см. transport.ts), а не сюда.
 */
import type {
  ConversationDto,
  CreateSessionInput,
  MessageDto,
  WidgetSessionDto,
} from '@support-widget/shared';

/** Общий помощник: бросает осмысленную ошибку, если ответ не 2xx. */
async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`[support-widget] ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/**
 * POST /widget/session — обменять public_key (+ запомненный visitorId) на
 * visitor-токен. Авторизации тут нет — это публичный эндпоинт.
 */
export async function createSession(
  apiUrl: string,
  input: CreateSessionInput,
): Promise<WidgetSessionDto> {
  const res = await fetch(`${apiUrl}/widget/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return asJson<WidgetSessionDto>(res);
}

/**
 * POST /widget/conversations — открыть диалог. Сервер переиспользует открытый
 * диалог посетителя, если он есть, иначе создаёт новый (см. сервис на бэке).
 */
export async function createConversation(
  apiUrl: string,
  token: string,
): Promise<ConversationDto> {
  const res = await fetch(`${apiUrl}/widget/conversations`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  return asJson<ConversationDto>(res);
}

/** GET /widget/conversations/:id/messages — история, от старых к новым. */
export async function listMessages(
  apiUrl: string,
  token: string,
  conversationId: string,
): Promise<MessageDto[]> {
  const res = await fetch(
    `${apiUrl}/widget/conversations/${conversationId}/messages`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  return asJson<MessageDto[]>(res);
}
