import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from '../events.controller';
import { EventsService } from '../events.service';
import { FollowsService } from '../../follows/follows.service';
import { ArtistEvent, EventRSVP, EventType } from '../entities/artist-event.entity';
import { CreateEventDto, PaginatedResult, PaginationDto, RsvpDto } from '../dto/events.dto';

const futureDate = (offsetMinutes = 120): Date =>
  new Date(Date.now() + offsetMinutes * 60 * 1000);

const mockEvent = (overrides: Partial<ArtistEvent> = {}): ArtistEvent =>
  ({
    id: 'event-uuid',
    artistId: 'artist-uuid',
    title: 'Test Concert',
    description: 'A great show',
    eventType: EventType.CONCERT,
    startTime: futureDate(),
    endTime: null,
    venue: 'Venue',
    streamUrl: null,
    ticketUrl: null,
    isVirtual: false,
    rsvpCount: 0,
    rsvps: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ArtistEvent);

const mockRsvp = (): EventRSVP =>
  ({
    id: 'rsvp-uuid',
    eventId: 'event-uuid',
    userId: 'user-uuid',
    reminderEnabled: true,
    reminderSent: false,
    createdAt: new Date(),
    event: mockEvent(),
  } as EventRSVP);

const mockEventsService = {
  createEvent: jest.fn(),
  getEventsByArtist: jest.fn(),
  getEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
  getFeed: jest.fn(),
  rsvp: jest.fn(),
  unRsvp: jest.fn(),
  getAttendees: jest.fn(),
};

const mockFollowsService = {
  getFollowedArtistIds: jest.fn(),
};

describe('EventsController', () => {
  let controller: EventsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        { provide: EventsService, useValue: mockEventsService },
        { provide: FollowsService, useValue: mockFollowsService },
      ],
    }).compile();

    controller = module.get(EventsController);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── createEvent ──────────────────────────────────────────────────────────

  describe('createEvent', () => {
    it('calls service.createEvent with artistId from JWT', async () => {
      const dto: CreateEventDto = {
        title: 'My Show',
        description: 'Desc',
        eventType: EventType.CONCERT,
        startTime: futureDate().toISOString(),
      };
      const event = mockEvent();
      mockEventsService.createEvent.mockResolvedValue(event);

      const result = await controller.createEvent('artist-uuid', dto);

      expect(mockEventsService.createEvent).toHaveBeenCalledWith('artist-uuid', dto);
      expect(result).toEqual(event);
    });
  });

  // ─── getEventsByArtist ────────────────────────────────────────────────────

  describe('getEventsByArtist', () => {
    it('delegates to service with artistId and pagination', async () => {
      const paginated = new PaginatedResult([mockEvent()], 1, 1, 20);
      mockEventsService.getEventsByArtist.mockResolvedValue(paginated);

      const result = await controller.getEventsByArtist('artist-uuid', { page: 1, limit: 20 });

      expect(mockEventsService.getEventsByArtist).toHaveBeenCalledWith('artist-uuid', {
        page: 1,
        limit: 20,
      });
      expect(result).toEqual(paginated);
    });
  });

  // ─── getFeed ──────────────────────────────────────────────────────────────

  describe('getFeed', () => {
    it('retrieves followed artist IDs then fetches feed', async () => {
      mockFollowsService.getFollowedArtistIds.mockResolvedValue(['a1', 'a2']);
      const paginated = new PaginatedResult([mockEvent()], 1, 1, 20);
      mockEventsService.getFeed.mockResolvedValue(paginated);

      const result = await controller.getFeed('user-uuid', { page: 1, limit: 20 });

      expect(mockFollowsService.getFollowedArtistIds).toHaveBeenCalledWith('user-uuid');
      expect(mockEventsService.getFeed).toHaveBeenCalledWith(['a1', 'a2'], { page: 1, limit: 20 });
      expect(result).toEqual(paginated);
    });

    it('returns empty feed when user follows nobody', async () => {
      mockFollowsService.getFollowedArtistIds.mockResolvedValue([]);
      const paginated = new PaginatedResult([], 0, 1, 20);
      mockEventsService.getFeed.mockResolvedValue(paginated);

      const result = await controller.getFeed('user-uuid', {});
      expect(result.data).toEqual([]);
    });
  });

  // ─── getEvent ─────────────────────────────────────────────────────────────

  describe('getEvent', () => {
    it('delegates to service', async () => {
      const event = mockEvent();
      mockEventsService.getEvent.mockResolvedValue(event);

      const result = await controller.getEvent('event-uuid');
      expect(result).toEqual(event);
    });
  });

  // ─── updateEvent ──────────────────────────────────────────────────────────

  describe('updateEvent', () => {
    it('calls service with eventId and artistId', async () => {
      const updated = mockEvent({ title: 'New Title' });
      mockEventsService.updateEvent.mockResolvedValue(updated);

      const result = await controller.updateEvent('event-uuid', 'artist-uuid', {
        title: 'New Title',
      });

      expect(mockEventsService.updateEvent).toHaveBeenCalledWith('event-uuid', 'artist-uuid', {
        title: 'New Title',
      });
      expect(result.title).toBe('New Title');
    });
  });

  // ─── deleteEvent ──────────────────────────────────────────────────────────

  describe('deleteEvent', () => {
    it('calls service.deleteEvent', async () => {
      mockEventsService.deleteEvent.mockResolvedValue(undefined);

      await controller.deleteEvent('event-uuid', 'artist-uuid');
      expect(mockEventsService.deleteEvent).toHaveBeenCalledWith('event-uuid', 'artist-uuid');
    });
  });

  // ─── rsvp ─────────────────────────────────────────────────────────────────

  describe('rsvp', () => {
    it('creates RSVP via service', async () => {
      const rsvp = mockRsvp();
      mockEventsService.rsvp.mockResolvedValue(rsvp);

      const dto: RsvpDto = { reminderEnabled: true };
      const result = await controller.rsvp('event-uuid', 'user-uuid', dto);

      expect(mockEventsService.rsvp).toHaveBeenCalledWith('event-uuid', 'user-uuid', dto);
      expect(result).toEqual(rsvp);
    });
  });

  // ─── unRsvp ───────────────────────────────────────────────────────────────

  describe('unRsvp', () => {
    it('removes RSVP via service', async () => {
      mockEventsService.unRsvp.mockResolvedValue(undefined);

      await controller.unRsvp('event-uuid', 'user-uuid');
      expect(mockEventsService.unRsvp).toHaveBeenCalledWith('event-uuid', 'user-uuid');
    });
  });

  // ─── getAttendees ─────────────────────────────────────────────────────────

  describe('getAttendees', () => {
    it('returns paginated attendees', async () => {
      const paginated = new PaginatedResult([mockRsvp()], 1, 1, 20);
      mockEventsService.getAttendees.mockResolvedValue(paginated);

      const result = await controller.getAttendees('event-uuid', { page: 1, limit: 20 });

      expect(mockEventsService.getAttendees).toHaveBeenCalledWith('event-uuid', {
        page: 1,
        limit: 20,
      });
      expect(result).toEqual(paginated);
    });
  });
});
