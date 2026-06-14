import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

// @Global: каждый feature-модуль получает DatabaseService через DI без необходимости
// импортировать DatabaseModule каждый раз. Один пул, общий для всего приложения.
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
