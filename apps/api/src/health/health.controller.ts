import { Controller, Get } from '@nestjs/common';

/**
 * Liveness probe. Cheap to add now; load balancers / orchestrators in v2+ will
 * poll it. Intentionally does NOT touch the DB — it answers "is the process up",
 * not "is every dependency healthy" (a deeper readiness check can come later).
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
