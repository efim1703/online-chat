/**
 * WebSocket-клиент виджета (браузерная сторона realtime).
 *
 * ## Концепция (прочитай, прежде чем писать)
 *
 * На сервере у нас RealtimeGateway на нативном `ws`: он авторизует соединение по
 * `?token=` в момент handshake, а дальше общается ОБЩИМ JSON-конвертом
 * `{ event, data }`. Клиент обязан говорить ровно на этом языке.
 *
 * Браузерный `WebSocket` — это событийная труба:
 *   - `new WebSocket(url)` — открывает соединение (токен кладём в query, как ждёт
 *     gateway: другого места для «заголовка авторизации» при WS-handshake нет);
 *   - `ws.onopen` — соединение готово; ТОЛЬКО после этого можно слать;
 *   - `ws.send(string)` — отправка; мы шлём `JSON.stringify({ event, data })`;
 *   - `ws.onmessage` — приём; в `event.data` лежит строка, которую надо распарсить
 *     обратно в конверт и разветвить по `msg.event`;
 *   - `ws.close()` — закрытие.
 *
 * Что делает ИМЕННО наш клиент в v0:
 *   1) подключается с токеном;
 *   2) как только соединение открылось — входит в комнату диалога
 *      (`conversation:join`), иначе сервер не будет слать нам события;
 *   3) на входящее `message:created` зовёт колбэк, который дорисует пузырь в UI;
 *   4) наружу отдаёт `sendVisitorMessage(body)` — он шлёт `visitor:message:create`
 *      (мы выбрали WS-only отправку; сервер сам сохранит в БД и разошлёт всем в
 *      комнате, включая нас — поэтому СВОИ сообщения мы НЕ рисуем оптимистично,
 *      ждём их обратно по `message:created`).
 *
 * Reconnect в v0 НЕ делаем (это осознанное упрощение; вернёмся к надёжности позже).
 *
 * ## Как проходить каркас
 * Иди сверху вниз и раскомментируй/допиши блоки по шагам. Типы конвертов —
 * `WsClientMessage` (что шлём) и `WsServerMessage` (что принимаем) — уже импортированы
 * ниже, опирайся на них, чтобы не ошибиться в именах событий и форме `data`.
 * В конце убери временный `throw`.
 */
import type {
  MessageDto,
  WsClientMessage,
  WsServerMessage,
} from '@support-widget/shared';

/** Что нужно клиенту, чтобы подключиться к комнате конкретного диалога. */
export interface ConnectOptions {
  wsUrl: string;
  token: string;
  conversationId: string;
  /** Зовётся на каждое входящее message:created (UI дорисует пузырь). */
  onMessageCreated: (msg: MessageDto) => void;
}

/** Чем index.ts управляет соединением после подключения. */
export interface RealtimeHandle {
  /** Отправить сообщение посетителя в текущий диалог по WS. */
  sendVisitorMessage: (body: string) => void;
  /** Закрыть соединение. */
  close: () => void;
}

export function connectRealtime(opts: ConnectOptions): RealtimeHandle {
  // ── Шаг 1. Открыть соединение ──────────────────────────────────────────────
  // Токен gateway читает из query upgrade-запроса (см. handleConnection на бэке).
  // Собери URL вида `${opts.wsUrl}?token=...` и создай WebSocket.
  // Подсказка: encodeURIComponent(opts.token), чтобы спецсимволы не поломали query.
  //
  const url = `${opts.wsUrl}?token=${encodeURIComponent(opts.token)}`;
  const ws = new WebSocket(url);

  // ── Шаг 2. Типобезопасный отправитель конверта ────────────────────────────
  // Все наши исходящие сообщения — это WsClientMessage ({ event, data }).
  // Сделай маленький помощник, который сериализует и шлёт. Приём msg целиком как
  // WsClientMessage заставит TypeScript проверить, что event и data совпадают.
  //
  const send = (msg: WsClientMessage): void => {
    ws.send(JSON.stringify(msg));
  };

  // ── Шаг 3. Войти в комнату ПОСЛЕ открытия ─────────────────────────────────
  // Слать до onopen нельзя. На onopen отправь conversation:join с conversationId.
  //
  ws.onopen = () => {
    send({ event: 'conversation:join', data: { conversationId: opts.conversationId } });
  };

  // ── Шаг 4. Принять и разветвить входящие ──────────────────────────────────
  // event.data — строка. Распарсь её в WsServerMessage и переключись по msg.event.
  // Для v0 обязателен ровно один кейс — 'message:created' → opts.onMessageCreated(msg.data).
  //
  // Развилка (реши сам): обрабатывать ли сейчас typing:started/typing:stopped?
  // В подзадачах v0-5 индикатора печати нет — можно НЕ добавлять (тогда просто
  // игнорируем их в default). Если захочешь — добавишь кейсы и пробросишь наверх
  // ещё одним колбэком. Рекомендация: пока пропустить, не убегать вперёд.
  //
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data as string) as WsServerMessage;
    switch (msg.event) {
      case 'message:created':
        opts.onMessageCreated(msg.data);
        break;
      // остальные server-события v0 виджету пока не нужны — игнорируем
      default:
        break;
    }
  };

  // ── Шаг 5. Вернуть handle наружу ──────────────────────────────────────────
  // sendVisitorMessage(body) шлёт visitor:message:create в текущий диалог.
  // close() закрывает сокет.
  //
  return {
    sendVisitorMessage: (body) => {
      send({
        event: 'visitor:message:create',
        data: { conversationId: opts.conversationId, body },
      });
    },
    close: () => ws.close(),
  };
}
