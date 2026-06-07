import { Module } from '@nestjs/common';

// Root module. Feature modules (database, widget, operator, realtime)
// will be wired in here in the following steps of v0-4.
@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
