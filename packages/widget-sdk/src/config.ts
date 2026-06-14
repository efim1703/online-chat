/**
 * Конфигурация виджета, вычитанная из тега `<script>`, которым его подключили.
 *
 * Пример встраивания (см. widget-demo-site, v0-6.1):
 *   <script src="http://localhost:3000/widget.js"
 *           data-project-id="pk_demo_local"
 *           data-api-url="http://localhost:3000"></script>
 */
export interface WidgetConfig {
  /** Публичный ключ проекта (projects.public_key). Уходит в POST /widget/session. */
  publicKey: string;
  /** База HTTP API, напр. http://localhost:3000. */
  apiUrl: string;
  /** База WebSocket, выведенная из apiUrl (http→ws, https→wss). */
  wsUrl: string;
}

/** API по умолчанию для локальной разработки v0 (api слушает :3000). */
const DEFAULT_API_URL = 'http://localhost:3000';

/**
 * Находит свой собственный тег `<script>` и читает из него data-атрибуты.
 *
 * `document.currentScript` указывает на исполняемый прямо сейчас скрипт — а наш
 * бандл self-executing (IIFE), поэтому в момент инициализации это и есть наш тег.
 * На случай экзотики (скрипт загружен как module/async, где currentScript === null)
 * откатываемся на поиск по [data-project-id].
 */
export function readConfig(): WidgetConfig {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>('script[data-project-id]');

  const publicKey = script?.dataset.projectId;
  if (!publicKey) {
    throw new Error(
      '[support-widget] missing data-project-id on the <script> tag',
    );
  }

  // Убираем хвостовой слэш, чтобы не получить двойной // при склейке путей.
  const apiUrl = (script?.dataset.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, '');

  return { publicKey, apiUrl, wsUrl: toWsUrl(apiUrl) };
}

/** http://host → ws://host, https://host → wss://host. */
function toWsUrl(apiUrl: string): string {
  return apiUrl.replace(/^http/, 'ws');
}
