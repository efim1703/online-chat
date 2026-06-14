/**
 * Весь UI виджета в одном месте. Чистый vanilla DOM, без фреймворка — чтобы
 * бандл оставался лёгким (v0-5.1).
 *
 * ## Почему Shadow DOM
 * Виджет встраивается на ЧУЖОЙ сайт. Если рисовать прямо в документе, то:
 *  - стили сайта-клиента (`* { box-sizing }`, агрессивные сбросы, `button {}`)
 *    потекут в наш UI и сломают его;
 *  - и наоборот, наши стили могли бы задеть сайт.
 * `attachShadow({ mode: 'open' })` создаёт изолированное поддерево: стили внутри
 * shadow root не выходят наружу и не впускают внешние. Поэтому весь UI и его
 * `<style>` живут внутри shadow root одного host-элемента.
 */
import type { MessageDto } from '@support-widget/shared';

/** Колбэки, через которые index.ts связывает UI с сетью. */
export interface UiHandlers {
  /** Посетитель отправил текст (клик или Enter). */
  onSend: (text: string) => void;
  /** Панель открыли ПЕРВЫЙ раз — повод лениво поднять сессию и WS. */
  onFirstOpen: () => void;
}

/** То, чем index.ts управляет UI после создания. */
export interface WidgetUi {
  /** Дорисовать одно входящее сообщение. */
  renderMessage: (msg: MessageDto) => void;
  /** Отрисовать историю целиком (при открытии диалога). */
  renderHistory: (msgs: MessageDto[]) => void;
}

// Стили виджета. Заперты внутри shadow root, поэтому имена классов короткие и
// без префиксов — конфликтов с сайтом-клиентом тут быть не может.
const STYLES = /* css */ `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: system-ui, sans-serif; }

  .launcher {
    position: fixed; right: 20px; bottom: 20px;
    width: 56px; height: 56px; border-radius: 50%;
    border: none; cursor: pointer;
    background: #2563eb; color: #fff; font-size: 24px;
    box-shadow: 0 4px 12px rgba(0,0,0,.2);
  }

  .panel {
    position: fixed; right: 20px; bottom: 88px;
    width: 340px; height: 460px; display: none;
    flex-direction: column; overflow: hidden;
    background: #fff; border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0,0,0,.25);
  }
  .panel.open { display: flex; }

  .header { padding: 14px 16px; background: #2563eb; color: #fff; font-weight: 600; }

  .messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }

  .bubble { max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 14px; line-height: 1.35; word-wrap: break-word; }
  .bubble.visitor { align-self: flex-end; background: #2563eb; color: #fff; border-bottom-right-radius: 2px; }
  .bubble.operator { align-self: flex-start; background: #f1f5f9; color: #0f172a; border-bottom-left-radius: 2px; }
  .bubble.system { align-self: center; background: transparent; color: #64748b; font-size: 12px; }

  .composer { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #e2e8f0; }
  .composer input { flex: 1; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
  .composer button { padding: 8px 14px; border: none; border-radius: 8px; background: #2563eb; color: #fff; cursor: pointer; }
`;

/**
 * Создаёт host-элемент, навешивает shadow root, строит DOM и провязывает события.
 * Возвращает методы для рендера сообщений.
 */
export function createUi(handlers: UiHandlers): WidgetUi {
  // Один host-элемент в конце <body> — носитель shadow root.
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  // Стили — первым узлом shadow root.
  const style = document.createElement('style');
  style.textContent = STYLES;
  root.appendChild(style);

  // Плавающая кнопка-лаунчер.
  const launcher = document.createElement('button');
  launcher.className = 'launcher';
  launcher.textContent = '💬';
  launcher.setAttribute('aria-label', 'Открыть чат');
  root.appendChild(launcher);

  // Панель чата: шапка + лента сообщений + строка ввода.
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="header">Поддержка</div>
    <div class="messages"></div>
    <form class="composer">
      <input type="text" placeholder="Напишите сообщение…" autocomplete="off" />
      <button type="submit">→</button>
    </form>
  `;
  root.appendChild(panel);

  const messagesEl = panel.querySelector('.messages') as HTMLDivElement;
  const form = panel.querySelector('.composer') as HTMLFormElement;
  const input = panel.querySelector('input') as HTMLInputElement;

  // Первое открытие — повод поднять сессию/WS лениво (не дёргаем сеть у тех,
  // кто чат так и не открыл).
  let opened = false;
  launcher.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    if (isOpen && !opened) {
      opened = true;
      handlers.onFirstOpen();
    }
    if (isOpen) input.focus();
  });

  // Отправка: отдаём текст наверх и чистим поле. Своё сообщение НЕ рисуем
  // оптимистично — оно прилетит обратно по WS как message:created (см. transport).
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    handlers.onSend(text);
    input.value = '';
  });

  /** Прокрутить ленту вниз — чтобы свежее сообщение было видно. */
  function scrollToBottom(): void {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderMessage(msg: MessageDto): void {
    const bubble = document.createElement('div');
    // senderType — строковый литерал ('visitor'|'operator'|'system'),
    // одновременно и класс выравнивания пузыря.
    bubble.className = `bubble ${msg.senderType}`;
    bubble.textContent = msg.body;
    messagesEl.appendChild(bubble);
    scrollToBottom();
  }

  function renderHistory(msgs: MessageDto[]): void {
    messagesEl.innerHTML = '';
    for (const msg of msgs) renderMessage(msg);
  }

  return { renderMessage, renderHistory };
}
