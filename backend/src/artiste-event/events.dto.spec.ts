import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateEventDto, PaginatedResult, PaginationDto, RsvpDto, UpdateEventDto } from '../dto/events.dto';
import { EventType } from '../entities/artist-event.entity';

const FUTURE = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

describe('Events DTOs', () => {
  // ─── CreateEventDto ───────────────────────────────────────────────────────

  describe('CreateEventDto', () => {
    it('passes with all required fields', async () => {
      const dto = plainToInstance(CreateEventDto, {
        title: 'My Concert',
        description: 'Great show',
        eventType: EventType.CONCERT,
        startTime: FUTURE,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('fails without title', async () => {
      const dto = plainToInstance(CreateEventDto, {
        description: 'desc',
        eventType: EventType.CONCERT,
        startTime: FUTURE,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('fails with invalid eventType', async () => {
      const dto = plainToInstance(CreateEventDto, {
        title: 'Title',
        description: 'desc',
        eventType: 'invalid_type',
        startTime: FUTURE,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'eventType')).toBe(true);
    });

    it('fails with invalid URL for streamUrl', async () => {
      const dto = plainToInstance(CreateEventDto, {
        title: 'Title',
        description: 'desc',
        eventType: EventType.LIVE_STREAM,
        startTime: FUTURE,
        streamUrl: 'not-a-url',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'streamUrl')).toBe(true);
    });

    it('passes with valid optional fields', async () => {
      const dto = plainToInstance(CreateEventDto, {
        title: 'Festival',
        description: 'Big event',
        eventType: EventType.CONCERT,
        startTime: FUTURE,
        endTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        venue: 'Central Park',
        streamUrl: 'https://stream.example.com',
        ticketUrl: 'https://tickets.example.com',
        isVirtual: false,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('fails when title exceeds max length', async () => {
      const dto = plainToInstance(CreateEventDto, {
        title: 'A'.repeat(256),
        description: 'desc',
        eventType: EventType.CONCERT,
        startTime: FUTURE,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });
  });

  // ─── UpdateEventDto ───────────────────────────────────────────────────────

  describe('UpdateEventDto', () => {
    it('passes with no fields (all optional)', async () => {
      const dto = plainToInstance(UpdateEventDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('validates provided fields', async () => {
      const dto = plainToInstance(UpdateEventDto, {
        eventType: 'bad_type',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'eventType')).toBe(true);
    });
  });

  // ─── RsvpDto ──────────────────────────────────────────────────────────────

  describe('RsvpDto', () => {
    it('passes with empty object', async () => {
      const dto = plainToInstance(RsvpDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('fails with non-boolean reminderEnabled', async () => {
      const dto = plainToInstance(RsvpDto, { reminderEnabled: 'yes' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reminderEnabled')).toBe(true);
    });
  });

  // ─── PaginationDto ────────────────────────────────────────────────────────

  describe('PaginationDto', () => {
    it('transforms string query params to numbers', async () => {
      const dto = plainToInstance(PaginationDto, { page: '2', limit: '5' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(5);
    });

    it('fails with page < 1', async () => {
      const dto = plainToInstance(PaginationDto, { page: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });

    it('fails with limit < 1', async () => {
      const dto = plainToInstance(PaginationDto, { limit: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });
  });

  // ─── PaginatedResult ──────────────────────────────────────────────────────

  describe('PaginatedResult', () => {
    it('computes totalPages correctly', () => {
      const result = new PaginatedResult(['a', 'b', 'c'], 25, 2, 10);
      expect(result.totalPages).toBe(3);
      expect(result.data).toEqual(['a', 'b', 'c']);
      expect(result.total).toBe(25);
    });

    it('handles zero total', () => {
      const result = new PaginatedResult([], 0, 1, 20);
      expect(result.totalPages).toBe(0);
    });

    it('handles exact multiple', () => {
      const result = new PaginatedResult([], 20, 1, 20);
      expect(result.totalPages).toBe(1);
    });
  });
});
