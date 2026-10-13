import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  MaxLength,
} from 'class-validator';

import { COMPARABLE_EVENT_TYPES } from '../comparison.constants';

/** `?asOf=YYYY-MM-DD` and `?eventTypes=a,b`, `?locations=A,B`. */
export class ComparisonQueryDto {
  @IsOptional()
  @IsDateString({ strict: true })
  asOf?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return value;
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  })
  @IsArray()
  @IsIn(COMPARABLE_EVENT_TYPES, { each: true })
  eventTypes?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return value;
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  })
  @IsArray()
  @IsOptional({ each: true })
  @MaxLength(80, { each: true })
  locations?: string[];
}