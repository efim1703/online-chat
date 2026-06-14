import { Module } from '@nestjs/common';
import { RealtimeRegistry } from './realtime-registry.service.js';

/**
 * Holds only the RealtimeRegistry, and exports it. Kept dependency-free on
 * purpose: both MessagesModule (so MessagesService can broadcast) and the
 * gateway import this module, so if it depended on either of them we'd create a
 * module-level import cycle. The RealtimeGateway itself is registered in
 * AppModule, where both RealtimeModule and MessagesModule are available.
 */
@Module({
  providers: [RealtimeRegistry],
  exports: [RealtimeRegistry],
})
export class RealtimeModule {}
