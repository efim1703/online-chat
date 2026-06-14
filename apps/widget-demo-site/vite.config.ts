import { defineConfig } from 'vite';

/**
 * Demo-сайт «клиента» — статическая площадка для проверки embed + CORS виджета.
 *
 * Порт жёстко зафиксирован на 5173 и совпадает с `allowed_origins` из seed
 * (apps/api/scripts/seed.ts → DEMO_ORIGIN = http://localhost:5173). Именно по
 * этому origin API пропускает widget-роуты, поэтому `strictPort: true` — если
 * 5173 занят, лучше упасть с ошибкой, чем тихо переехать на 5174 и сломать CORS.
 *
 * Собранный widget.js берётся из packages/widget-sdk/dist через симлинк
 * public/widget.js (Vite отдаёт содержимое public/ по корневому пути `/`),
 * поэтому отдельной build-конфигурации виджета здесь не нужно.
 */
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
});
