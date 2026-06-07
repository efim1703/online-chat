// reflect-metadata must be imported once, before any decorated class is loaded,
// so NestJS can read the DI metadata emitted by the TypeScript compiler.
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
// NodeNext ESM requires the .js extension on relative imports.
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
