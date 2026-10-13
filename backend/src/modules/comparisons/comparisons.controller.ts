import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';

import {
  COMPARABLE_EVENT_TYPES,
  type ComparableEventType,
} from './comparison.constants';
import { ComparisonsService } from './comparisons.service';
import { ComparisonQueryDto } from './dto/comparison-query.dto';
import type {
  AccountComparisonDto,
  AccountDetailDto,
  AccountSummaryDto,
  LocationComparisonResponseDto,
  LocationsDto,
} from './dto/comparison.dto';

@Controller()
export class ComparisonsController {
  constructor(private readonly comparisons: ComparisonsService) {}

  @Get('accounts')
  listAccounts(): Promise<AccountSummaryDto[]> {
    return this.comparisons.listAccounts();
  }

  @Get('accounts/:id')
  getAccount(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AccountDetailDto> {
    return this.comparisons.getAccount(id);
  }

  @Get('accounts/:id/locations')
  async listLocations(@Param('id', ParseIntPipe) id: number): Promise<LocationsDto> {
    return { accountId: id, locations: await this.comparisons.listLocations(id) };
  }

  @Get('accounts/:id/comparison')
  compareAccount(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ComparisonQueryDto,
  ): Promise<AccountComparisonDto> {
    return this.comparisons.compareAccount(
      id,
      this.validateAsOf(query.asOf),
      this.validateEventTypes(query.eventTypes),
    );
  }

  @Get('accounts/:id/comparison/locations')
  compareLocations(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ComparisonQueryDto,
  ): Promise<LocationComparisonResponseDto> {
    return this.comparisons.compareLocations(
      id,
      this.validateAsOf(query.asOf),
      this.validateEventTypes(query.eventTypes),
      query.locations,
    );
  }

  private validateAsOf(asOf?: string): string | undefined {
    if (!asOf) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
      throw new BadRequestException('asOf must be a date formatted YYYY-MM-DD');
    }
    return asOf;
  }

  private validateEventTypes(eventTypes?: string[]): ComparableEventType[] {
    const requested = eventTypes?.length ? eventTypes : [...COMPARABLE_EVENT_TYPES];
    const allowed: readonly string[] = COMPARABLE_EVENT_TYPES;
    const unknown = requested.filter((eventType) => !allowed.includes(eventType));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown event type(s): ${unknown.join(', ')}. Expected one of ${COMPARABLE_EVENT_TYPES.join(', ')}`,
      );
    }
    return requested as ComparableEventType[];
  }
}