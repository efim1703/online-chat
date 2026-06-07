import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';

// Resolve the monorepo-root .env relative to this file (not cwd), so the api
// finds it regardless of where it was launched from. This module lives at
// apps/api/{src,dist}/app.module — three levels below the repo root.
const rootEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env');

// Root module. More feature modules (widget, operator, realtime) will be
// wired in here in the following steps of v0-4.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: rootEnvPath,
    }),
    DatabaseModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
