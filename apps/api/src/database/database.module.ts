import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

// @Global: every feature module gets DatabaseService injected without having
// to import DatabaseModule each time. One pool, shared app-wide.
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
