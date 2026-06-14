import { defineConfig } from 'tsup';

/**
 * Сборка встраиваемого виджета в ОДИН самозапускающийся бандл.
 *
 * Почему `iife`, а не `esm`/`cjs`: виджет подключают на чужом сайте обычным
 * тегом `<script src="widget.js">`, без сборщика и без `type="module"`. IIFE
 * сразу исполняется и не оставляет глобальных имён, которые могли бы
 * столкнуться с кодом сайта-клиента.
 *
 * `@support-widget/shared` импортируется ТОЛЬКО как типы (`import type`), их
 * стирает TypeScript, поэтому в бандл не попадает ни строчки рантайма — он
 * остаётся «лёгким», как требует v0-5.1.
 */
export default defineConfig({
  // Имя ключа задаёт имя выходного файла → dist/widget.js (см. outExtension).
  entry: { widget: 'src/index.ts' },
  format: ['iife'],
  // Браузеры посетителей — берём широкую, но современную цель.
  target: 'es2020',
  platform: 'browser',
  // Один файл: без code-splitting (для iife он и так невозможен).
  splitting: false,
  minify: true,
  sourcemap: true,
  // Чистить dist перед каждой сборкой.
  clean: true,
  // По умолчанию iife даёт .global.js — переименовываем в привычный .js.
  outExtension: () => ({ js: '.js' }),
});
