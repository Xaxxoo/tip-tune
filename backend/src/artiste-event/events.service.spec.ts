import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { ArtistEvent, EventRSVP, EventType } from '../entities/artist-event.entity';
import { EventsService } from '../events.service';
import { CreateEventDto, PaginationDto, RsvpDto } from '../dto/events.dto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const futureDate = (offsetMinutes = 120): Date =>
  new Date(Date.now() + offsetMinutes * 60 * 1000);

const pastDate = (offsetMinutes = 60): Date =>
  new Date(Date.now() - offsetMinutes * 60 * 1000);

const buildEvent = (overrides: Partial<ArtistEvent> = {}): ArtistEvent =>
  ({
    id: 'event-uuid',
    artistId: 'artist-uuid',
    title: 'Test Concert',
    description: 'An awesome show',
    eventType: EventType.CONCERT,
    startTime: futureDate(),
    endTime: null,
    venue: 'Madison Square Garden',
    streamUrl: null,
    ticketUrl: null,
    isVirtual: false,
    rsvpCount: 0,
    rsvps: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ArtistEvent);

const buildRsvp = (overrides: Partial<EventRSVP> = {}): EventRSVP =>
  ({
    id: 'rsvp-uuid',
    eventId: 'event-uuid',
    userId: 'user-uuid',
    reminderEnabled: true,
    reminderSent: false,
    createdAt: new Date(),
    event: buildEvent(),
    ...overrides,
  } as EventRSVP);

const mockEventRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  remove: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockRsvpRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
  update: jest.fn(),
});

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue(undefined),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EventsService', () => {
  let service: EventsService;
  let eventRepo: ReturnType<typeof mockEventRepo>;
  let rsvpRepo: ReturnType<typeof mockRsvpRepo>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    const mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(ArtistEvent), useFactory: mockEventRepo },
        { provide: getRepositoryToken(EventRSVP), useFactory: mockRsvpRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(EventsService);
    eventRepo = module.get(getRepositoryToken(ArtistEvent));
    rsvpRepo = module.get(getRepositoryToken(EventRSVP));
    dataSource = module.get(DataSource);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── createEvent ──────────────────────────────────────────────────────────

  describe('createEvent', () => {
    const dto: CreateEventDto = {
      title: 'Test Concert',
      description: 'A show',
      eventType: EventType.CONCERT,
      startTime: futureDate().toISOString(),
    };

    it('creates and returns an event', async () => {
      const event = buildEvent();
      eventRepo.create.mockReturnValue(event);
      eventRepo.save.mockResolvedValue(event);

      const result = await service.createEvent('artist-uuid', dto);

      expect(eventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ artistId: 'artist-uuid', title: 'Test Concert' }),
      );
      expect(result).toEqual(event);
    });

    it('throws BadRequestException if start time is in the past', async () => {
      await expect(
        service.createEvent('artist-uuid', { ...dto, startTime: pastDate().toISOString() }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if end time is before start time', async () => {
      const start = futureDate(120);
      const end = futureDate(60);
      await expect(
        service.createEvent('artist-uuid', {
          ...dto,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows valid endTime after startTime', async () => {
      const event = buildEvent({ endTime: futureDate(180) });
      eventRepo.create.mockReturnValue(event);
      eventRepo.save.mockResolvedValue(event);

      await expect(
        service.createEvent('artist-uuid', {
          ...dto,
          endTime: futureDate(180).toISOString(),
        }),
      ).resolves.toEqual(event);
    });
  });

  // ─── getEventsByArtist ────────────────────────────────────────────────────

  describe('getEventsByArtist', () => {
    it('returns paginated events for artist', async () => {
      const events = [buildEvent()];
      eventRepo.findAndCount.mockResolvedValue([events, 1]);

      const result = await service.getEventsByArtist('artist-uuid', { page: 1, limit: 10 });

      expect(result.data).toEqual(events);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('uses default pagination when not provided', async () => {
      eventRepo.findAndCount.mockResolvedValue([[], 0]);
      await service.getEventsByArtist('artist-uuid', {});

      expect(eventRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('calculates skip correctly for page 2', async () => {
      eventRepo.findAndCount.mockResolvedValue([[], 0]);
      await service.getEventsByArtist('artist-uuid', { page: 2, limit: 5 });

      expect(eventRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });
  });

  // ─── getEvent ─────────────────────────────────────────────────────────────

  describe('getEvent', () => {
    it('returns event when found', async () => {
      const event = buildEvent();
      eventRepo.findOne.mockResolvedValue(event);

      const result = await service.getEvent('event-uuid');
      expect(result).toEqual(event);
    });

    it('throws NotFoundException when not found', async () => {
      eventRepo.findOne.mockResolvedValue(null);
      await expect(service.getEvent('missing-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateEvent ──────────────────────────────────────────────────────────

  describe('updateEvent', () => {
    it('updates and returns the event', async () => {
      const event = buildEvent();
      eventRepo.findOne.mockResolvedValue(event);
      eventRepo.save.mockResolvedValue({ ...event, title: 'Updated' });

      const result = await service.updateEvent('event-uuid', 'artist-uuid', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });

    it('throws ForbiddenException if artist does not own event', async () => {
      eventRepo.findOne.mockResolvedValue(buildEvent({ artistId: 'other-artist' }));
      await expect(
        service.updateEvent('event-uuid', 'artist-uuid', { title: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if updated endTime is before startTime', async () => {
      const event = buildEvent({ startTime: futureDate(120) });
      eventRepo.findOne.mockResolvedValue(event);

      await expect(
        service.updateEvent('event-uuid', 'artist-uuid', {
          endTime: futureDate(60).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── deleteEvent ──────────────────────────────────────────────────────────

  describe('deleteEvent', () => {
    it('removes the event', async () => {
      const event = buildEvent();
      eventRepo.findOne.mockResolvedValue(event);
      eventRepo.remove.mockResolvedValue(event);

      await service.deleteEvent('event-uuid', 'artist-uuid');
      expect(eventRepo.remove).toHaveBeenCalledWith(event);
    });

    it('throws ForbiddenException if not the owner', async () => {
      eventRepo.findOne.mockResolvedValue(buildEvent({ artistId: 'someone-else' }));
      await expect(service.deleteEvent('event-uuid', 'artist-uuid')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── getFeed ──────────────────────────────────────────────────────────────

  describe('getFeed', () => {
    it('returns empty result when no followed artists', async () => {
      const result = await service.getFeed([], { page: 1, limit: 20 });
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(eventRepo.findAndCount).not.toHaveBeenCalled();
    });

    it('returns upcoming events from followed artists', async () => {
      const events = [buildEvent()];
      eventRepo.findAndCount.mockResolvedValue([events, 1]);

      const result = await service.getFeed(['artist-1', 'artist-2'], { page: 1, limit: 20 });
      expect(result.data).toEqual(events);
    });

    it('filters by MoreThan current time', async () => {
      eventRepo.findAndCount.mockResolvedValue([[], 0]);
      await service.getFeed(['artist-1'], { page: 1, limit: 20 });

      expect(eventRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ artistId: In(['artist-1']) }),
        }),
      );
    });
  });

  // ─── rsvp ─────────────────────────────────────────────────────────────────

  describe('rsvp', () => {
    const dto: RsvpDto = { reminderEnabled: true };

    it('creates RSVP and increments rsvpCount', async () => {
      const event = buildEvent();
      const rsvp = buildRsvp();
      eventRepo.findOne.mockResolvedValue(event);
      rsvpRepo.findOne.mockResolvedValue(null);

      const transactionManager = {
        create: jest.fn().mockReturnValue(rsvp),
        save: jest.fn().mockResolvedValue(rsvp),
        createQueryBuilder: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue(undefined),
        }),
      };
      dataSource.transaction.mockImplementation((cb: Function) => cb(transactionManager));

      const result = await service.rsvp('event-uuid', 'user-uuid', dto);

      expect(result).toEqual(rsvp);
      expect(transactionManager.save).toHaveBeenCalled();
    });

    it('throws BadRequestException for past event', async () => {
      eventRepo.findOne.mockResolvedValue(buildEvent({ startTime: pastDate() }));
      await expect(service.rsvp('event-uuid', 'user-uuid', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException if already RSVPed', async () => {
      eventRepo.findOne.mockResolvedValue(buildEvent());
      rsvpRepo.findOne.mockResolvedValue(buildRsvp());

      await expect(service.rsvp('event-uuid', 'user-uuid', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('sets reminderEnabled to true by default', async () => {
      const event = buildEvent();
      eventRepo.findOne.mockResolvedValue(event);
      rsvpRepo.findOne.mockResolvedValue(null);

      const savedRsvp = buildRsvp({ reminderEnabled: true });
      const transactionManager = {
        create: jest.fn().mockReturnValue(savedRsvp),
        save: jest.fn().mockResolvedValue(savedRsvp),
        createQueryBuilder: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue(undefined),
        }),
      };
      dataSource.transaction.mockImplementation((cb: Function) => cb(transactionManager));

      await service.rsvp('event-uuid', 'user-uuid', {});
      expect(transactionManager.create).toHaveBeenCalledWith(
        EventRSVP,
        expect.objectContaining({ reminderEnabled: true }),
      );
    });
  });

  // ─── unRsvp ───────────────────────────────────────────────────────────────

  describe('unRsvp', () => {
    it('removes RSVP and decrements rsvpCount', async () => {
      const rsvp = buildRsvp();
      rsvpRepo.findOne.mockResolvedValue(rsvp);

      const transactionManager = {
        remove: jest.fn().mockResolvedValue(rsvp),
        createQueryBuilder: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue(undefined),
        }),
      };
      dataSource.transaction.mockImplementation((cb: Function) => cb(transactionManager));

      await service.unRsvp('event-uuid', 'user-uuid');
      expect(transactionManager.remove).toHaveBeenCalledWith(rsvp);
    });

    it('throws NotFoundException if RSVP does not exist', async () => {
      rsvpRepo.findOne.mockResolvedValue(null);
      await expect(service.unRsvp('event-uuid', 'user-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getAttendees ─────────────────────────────────────────────────────────

  describe('getAttendees', () => {
    it('returns paginated attendees', async () => {
      const event = buildEvent();
      const rsvps = [buildRsvp()];
      eventRepo.findOne.mockResolvedValue(event);
      rsvpRepo.findAndCount.mockResolvedValue([rsvps, 1]);

      const result = await service.getAttendees('event-uuid', { page: 1, limit: 10 });
      expect(result.data).toEqual(rsvps);
      expect(result.total).toBe(1);
    });

    it('throws NotFoundException if event not found', async () => {
      eventRepo.findOne.mockResolvedValue(null);
      await expect(service.getAttendees('bad-uuid', {})).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getEventsStartingSoon ────────────────────────────────────────────────

  describe('getEventsStartingSoon', () => {
    it('returns events starting in ~1 hour', async () => {
      const events = [buildEvent({ startTime: futureDate(58) })];
      eventRepo.createQueryBuilder.mockReturnValue({
        ...mockQueryBuilder,
        getMany: jest.fn().mockResolvedValue(events),
      });

      const result = await service.getEventsStartingSoon();
      expect(result).toEqual(events);
    });
  });

  // ─── getRsvpsForReminder ──────────────────────────────────────────────────

  describe('getRsvpsForReminder', () => {
    it('returns only unsent reminders with reminder enabled', async () => {
      const rsvps = [buildRsvp({ reminderEnabled: true, reminderSent: false })];
      rsvpRepo.find.mockResolvedValue(rsvps);

      const result = await service.getRsvpsForReminder('event-uuid');
      expect(rsvpRepo.find).toHaveBeenCalledWith({
        where: { eventId: 'event-uuid', reminderEnabled: true, reminderSent: false },
      });
      expect(result).toEqual(rsvps);
    });
  });

  // ─── markReminderSent ─────────────────────────────────────────────────────

  describe('markReminderSent', () => {
    it('does nothing for empty array', async () => {
      await service.markReminderSent([]);
      expect(rsvpRepo.update).not.toHaveBeenCalled();
    });

    it('updates reminder_sent flag for all provided IDs', async () => {
      rsvpRepo.update.mockResolvedValue({ affected: 2 });
      await service.markReminderSent(['id-1', 'id-2']);
      expect(rsvpRepo.update).toHaveBeenCalledWith(
        { id: In(['id-1', 'id-2']) },
        { reminderSent: true },
      );
    });
  });
});
