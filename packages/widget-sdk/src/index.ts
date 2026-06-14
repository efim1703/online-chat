/**
 * Точка входа бандла widget.js (IIFE: исполняется сразу при загрузке тега).
 *
 * Связывает три слоя:
 *   config  — кто мы (public key, куда ходить);
 *   ui      — кнопка + панель в Shadow DOM;
 *   api+transport — сеть (HTTP-сессия/диалог/история и WS-realtime).
 *
 * Стратегия — ленивая: сразу рисуем только кнопку. Сессию, диалог и WS поднимаем
 * при ПЕРВОМ открытии панели (onFirstOpen) — не дёргаем сеть у тех, кто чат не
 * открыл, и не плодим пустые диалоги.
 */
import { createConversation, createSession, listMessages } from './api';
import { readConfig } from './config';
import { connectRealtime, type RealtimeHandle } from './transport';
import { createUi } from './ui';

/** Ключ localStorage для запоминания visitorId (свой на каждый public key). */
function visitorStorageKey(publicKey: string): string {
  return `support-widget:visitorId:${publicKey}`;
}

function bootstrap(): void {
  const config = readConfig();

  // Активное WS-соединение появляется после первого открытия панели.
  let realtime: RealtimeHandle | null = null;

  const ui = createUi({
    // Отправка из строки ввода → по WS. Если ещё не подключились — молча выходим
    // (кнопка отправки доступна только в открытой панели, так что это край).
    onSend: (text) => {
      realtime?.sendVisitorMessage(text);
    },
    // Первое открытие панели — поднимаем всю сеть.
    onFirstOpen: () => {
      void start();
    },
  });

  /** Полный поток подключения: сессия → диалог → история → WS → join. */
  async function start(): Promise<void> {
    // Запомненный с прошлого раза visitorId (если есть) — чтобы вернуть историю.
    const savedVisitorId =
      localStorage.getItem(visitorStorageKey(config.publicKey)) ?? undefined;

    // 1) Сессия: public key (+ старый visitorId) → visitor-токен.
    const session = await createSession(config.apiUrl, {
      publicKey: config.publicKey,
      visitorId: savedVisitorId,
    });
    // Сохраняем visitorId для следующего визита.
    localStorage.setItem(
      visitorStorageKey(config.publicKey),
      session.visitorId,
    );

    // 2) Диалог: сервер переиспользует открытый или создаёт новый.
    const conversation = await createConversation(config.apiUrl, session.token);

    // 3) История диалога — рисуем до подключения к realtime.
    const history = await listMessages(
      config.apiUrl,
      session.token,
      conversation.id,
    );
    ui.renderHistory(history);

    // 4) WS: подключаемся, входим в комнату, на message:created дорисовываем пузырь.
    realtime = connectRealtime({
      wsUrl: config.wsUrl,
      token: session.token,
      conversationId: conversation.id,
      onMessageCreated: (msg) => ui.renderMessage(msg),
    });
  }
}

bootstrap();
