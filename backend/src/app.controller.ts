import { Controller, Get } from '@nestjs/common';

/**
 * Phase 0 scaffold endpoint. Real dashboard endpoints
 * (`/accounts`, `/accounts/:id/comparison`, ...) land in Phase 2.
 */
@Controller()
export class AppController {
  @Get('health')
  health(): { status: string; phase: string } {
    return { status: 'ok', phase: 'scaffold' };
  }
}