import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventsModule } from '../events.module';
import { ArtistEvent, EventRSVP, EventType } from '../entities/artist-event.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ArtistGuard } from '../guards/artist.guard';
import { FollowsService } from '../../follows/follows.service';
import { NotificationsService } from '../../notifications/notifications.service';

const FUTURE = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const ARTIST_USER = { sub: 'user-artist', artistId: 'artist-uuid' };
const FAN_USER = { sub: 'user-fan', artistId: undefined };

// Mock guards that inject user from header
class MockJwtAuthGuard {
  canActivate(ctx: any) {
    const req = ctx.switchToHttp().getRequest();
    const userJson = req.headers['x-test-user'];
    req.user = userJson ? JSON.parse(userJson) : FAN_USER;
    return true;
  }
}

class MockArtistGuard {
  canActivate(ctx: any) {
    const req = ctx.switchToHttp().getRequest();
    return !!req.user?.artistId;
  }
}

describe('EventsModule (e2e)', () => {
  let app: INestApplication;
  let eventRepo: jest.Mocked<Repository<ArtistEvent>>;
  let rsvpRepo: jest.Mocked<Repository<EventRSVP>>;
  let followsService: jest.Mocked<FollowsService>;

  const baseEvent: ArtistEvent = {
    id: 'event-uuid',
    artistId: 'artist-uuid',
    title: 'My Live Show',
    description: 'Come join!',
    eventType: EventType.LIVE_STREAM,
    startTime: new Date(FUTURE),
    endTime: null,
    venue: null,
    streamUrl: 'https://stream.example.com',
    ticketUrl: null,
    isVirtual: true,
    rsvpCount: 0,
    rsvps: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const baseRsvp: EventRSVP = {
    id: 'rsvp-uuid',
    eventId: 'event-uuid',
    userId: 'user-fan',
    reminderEnabled: true,
    reminderSent: false,
    createdAt: new Date(),
    event: baseEvent,
  };

  beforeAll(async () => {
    const mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [EventsModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .overrideGuard(ArtistGuard)
      .useClass(MockArtistGuard)
      .overrideProvider(getRepositoryToken(ArtistEvent))
      .useValue({
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        findAndCount: jest.fn(),
        remove: jest.fn(),
        update: jest.fn(),
        createQueryBuilder: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(EventRSVP))
      .useValue({
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        findAndCount: jest.fn(),
        find: jest.fn(),
        remove: jest.fn(),
        update: jest.fn(),
      })
      .overrideProvider(DataSource)
      .useValue(mockDataSource)
      .overrideProvider(FollowsService)
      .useValue({ getFollowedArtistIds: jest.fn() })
      .overrideProvider(NotificationsService)
      .useValue({ sendEventReminders: jest.fn() })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    eventRepo = module.get(getRepositoryToken(ArtistEvent));
    rsvpRepo = module.get(getRepositoryToken(EventRSVP));
    followsService = module.get(FollowsService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  // ─── POST /api/events ─────────────────────────────────────────────────────

  describe('POST /api/events', () => {
    it('creates an event as artist', async () => {
      eventRepo.create.mockReturnValue(baseEvent as any);
      eventRepo.save.mockResolvedValue(baseEvent as any);

      const res = await request(app.getHttpServer())
        .post('/api/events')
        .set('x-test-user', JSON.stringify(ARTIST_USER))
        .send({
          title: 'My Live Show',
          description: 'Come join!',
          eventType: EventType.LIVE_STREAM,
          startTime: FUTURE,
          isVirtual: true,
          streamUrl: 'https://stream.example.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('My Live Show');
    });

    it('rejects creation as non-artist (403)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/events')
        .set('x-test-user', JSON.stringify(FAN_USER))
        .send({
          title: 'My Show',
          description: 'desc',
          eventType: EventType.CONCERT,
          startTime: FUTURE,
        });

      expect(res.status).toBe(403);
    });

    it('rejects invalid payload (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/events')
        .set('x-test-user', JSON.stringify(ARTIST_USER))
        .send({ title: 'No event type or start time' });

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/events/artist/:artistId ─────────────────────────────────────

  describe('GET /api/events/artist/:artistId', () => {
    it('returns paginated events for artist', async () => {
      eventRepo.findAndCount.mockResolvedValue([[baseEvent] as any, 1]);

      const res = await request(app.getHttpServer())
        .get('/api/events/artist/artist-uuid?page=1&limit=10')
        .set('x-test-user', JSON.stringify(FAN_USER));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(1);
    });
  });

  // ─── GET /api/events/feed ─────────────────────────────────────────────────

  describe('GET /api/events/feed', () => {
    it("returns upcoming events from user's followed artists", async () => {
      (followsService.getFollowedArtistIds as jest.Mock).mockResolvedValue(['artist-uuid']);
      eventRepo.findAndCount.mockResolvedValue([[baseEvent] as any, 1]);

      const res = await request(app.getHttpServer())
        .get('/api/events/feed')
        .set('x-test-user', JSON.stringify(FAN_USER));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns empty feed when not following anyone', async () => {
      (followsService.getFollowedArtistIds as jest.Mock).mockResolvedValue([]);
      eventRepo.findAndCount.mockResolvedValue([[], 0]);

      const res = await request(app.getHttpServer())
        .get('/api/events/feed')
        .set('x-test-user', JSON.stringify(FAN_USER));

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // ─── POST /api/events/:eventId/rsvp ───────────────────────────────────────

  describe('POST /api/events/:eventId/rsvp', () => {
    it('creates RSVP for upcoming event', async () => {
      eventRepo.findOne.mockResolvedValue(baseEvent as any);
      rsvpRepo.findOne.mockResolvedValue(null);

      const transactionManager = {
        create: jest.fn().mockReturnValue(baseRsvp),
        save: jest.fn().mockResolvedValue(baseRsvp),
        createQueryBuilder: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue(undefined),
        }),
      };
      (app.get(DataSource) as any).transaction.mockImplementation((cb: Function) =>
        cb(transactionManager),
      );

      const res = await request(app.getHttpServer())
        .post('/api/events/event-uuid/rsvp')
        .set('x-test-user', JSON.stringify(FAN_USER))
        .send({ reminderEnabled: true });

      expect(res.status).toBe(201);
    });

    it('rejects RSVP for past event (400)', async () => {
      eventRepo.findOne.mockResolvedValue({ ...baseEvent, startTime: new Date(PAST) } as any);

      const res = await request(app.getHttpServer())
        .post('/api/events/event-uuid/rsvp')
        .set('x-test-user', JSON.stringify(FAN_USER))
        .send({});

      expect(res.status).toBe(400);
    });

    it('rejects duplicate RSVP (409)', async () => {
      eventRepo.findOne.mockResolvedValue(baseEvent as any);
      rsvpRepo.findOne.mockResolvedValue(baseRsvp as any);

      const res = await request(app.getHttpServer())
        .post('/api/events/event-uuid/rsvp')
        .set('x-test-user', JSON.stringify(FAN_USER))
        .send({});

      expect(res.status).toBe(409);
    });
  });

  // ─── DELETE /api/events/:eventId/rsvp ────────────────────────────────────

  describe('DELETE /api/events/:eventId/rsvp', () => {
    it('removes RSVP successfully (200)', async () => {
      rsvpRepo.findOne.mockResolvedValue(baseRsvp as any);

      const transactionManager = {
        remove: jest.fn().mockResolvedValue(baseRsvp),
        createQueryBuilder: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue(undefined),
        }),
      };
      (app.get(DataSource) as any).transaction.mockImplementation((cb: Function) =>
        cb(transactionManager),
      );

      const res = await request(app.getHttpServer())
        .delete('/api/events/event-uuid/rsvp')
        .set('x-test-user', JSON.stringify(FAN_USER));

      expect(res.status).toBe(200);
    });

    it('returns 404 if RSVP not found', async () => {
      rsvpRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .delete('/api/events/event-uuid/rsvp')
        .set('x-test-user', JSON.stringify(FAN_USER));

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/events/:eventId/attendees ───────────────────────────────────

  describe('GET /api/events/:eventId/attendees', () => {
    it('returns paginated attendees', async () => {
      eventRepo.findOne.mockResolvedValue(baseEvent as any);
      rsvpRepo.findAndCount.mockResolvedValue([[baseRsvp] as any, 1]);

      const res = await request(app.getHttpServer())
        .get('/api/events/event-uuid/attendees?page=1&limit=20')
        .set('x-test-user', JSON.stringify(FAN_USER));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('returns 404 if event not found', async () => {
      eventRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/events/bad-uuid/attendees')
        .set('x-test-user', JSON.stringify(FAN_USER));

      expect(res.status).toBe(404);
    });
  });
});
