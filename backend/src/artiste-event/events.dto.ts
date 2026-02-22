import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { EventType } from '../entities/artist-event.entity';

export class CreateEventDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  description: string;

  @IsEnum(EventType)
  eventType: EventType;

  @IsDateString()
  startTime: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  venue?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  streamUrl?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  ticketUrl?: string;

  @IsOptional()
  @IsBoolean()
  isVirtual?: boolean;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  venue?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  streamUrl?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  ticketUrl?: string;

  @IsOptional()
  @IsBoolean()
  isVirtual?: boolean;
}

export class RsvpDto {
  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;
}

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
  }
}
