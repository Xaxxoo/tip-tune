import { Test, TestingModule } from '@nestjs/testing';
import { EventsScheduler } from '../events.scheduler';
import { EventsService } from '../events.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ArtistEvent, EventRSVP, EventType } from '../entities/artist-event.entity';

const futureDate = (offsetMinutes = 60): Date =>
  new Date(Date.now() + offsetMinutes * 60 * 1000);

const buildEvent = (id = 'event-1'): ArtistEvent =>
  ({
    id,
    artistId: 'artist-uuid',
    title: 'Upcoming Show',
    description: 'desc',
    eventType: EventType.LIVE_STREAM,
    startTime: futureDate(58),
    endTime: null,
    venue: null,
    streamUrl: 'https://stream.example.com',
    ticketUrl: null,
    isVirtual: true,
    rsvpCount: 3,
    rsvps: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ArtistEvent);

const buildRsvp = (userId: string, id: string): EventRSVP =>
  ({
    id,
    eventId: 'event-1',
    userId,
    reminderEnabled: true,
    reminderSent: false,
    createdAt: new Date(),
    event: buildEvent(),
  } as EventRSVP);

const mockEventsService = {
  getEventsStartingSoon: jest.fn(),
  getRsvpsForReminder: jest.fn(),
  markReminderSent: jest.fn(),
};

const mockNotificationsService = {
  sendEventReminders: jest.fn(),
};

describe('EventsScheduler', () => {
  let scheduler: EventsScheduler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsScheduler,
        { provide: EventsService, useValue: mockEventsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    scheduler = module.get(EventsScheduler);
  });

  afterEach(() => jest.clearAllMocks());

  it('does nothing when no events are starting soon', async () => {
    mockEventsService.getEventsStartingSoon.mockResolvedValue([]);

    await scheduler.sendEventReminders();

    expect(mockEventsService.getRsvpsForReminder).not.toHaveBeenCalled();
    expect(mockNotificationsService.sendEventReminders).not.toHaveBeenCalled();
  });

  it('sends reminders for all RSVPs of upcoming events', async () => {
    const event = buildEvent('event-1');
    const rsvps = [
      buildRsvp('user-1', 'rsvp-1'),
      buildRsvp('user-2', 'rsvp-2'),
    ];

    mockEventsService.getEventsStartingSoon.mockResolvedValue([event]);
    mockEventsService.getRsvpsForReminder.mockResolvedValue(rsvps);
    mockEventsService.markReminderSent.mockResolvedValue(undefined);
    mockNotificationsService.sendEventReminders.mockResolvedValue(undefined);

    await scheduler.sendEventReminders();

    expect(mockEventsService.getRsvpsForReminder).toHaveBeenCalledWith('event-1');
    expect(mockNotificationsService.sendEventReminders).toHaveBeenCalledWith(
      ['user-1', 'user-2'],
      event,
    );
    expect(mockEventsService.markReminderSent).toHaveBeenCalledWith(['rsvp-1', 'rsvp-2']);
  });

  it('skips events with no RSVPs eligible for reminders', async () => {
    const event = buildEvent('event-1');
    mockEventsService.getEventsStartingSoon.mockResolvedValue([event]);
    mockEventsService.getRsvpsForReminder.mockResolvedValue([]);

    await scheduler.sendEventReminders();

    expect(mockNotificationsService.sendEventReminders).not.toHaveBeenCalled();
    expect(mockEventsService.markReminderSent).not.toHaveBeenCalled();
  });

  it('processes multiple events independently', async () => {
    const event1 = buildEvent('event-1');
    const event2 = buildEvent('event-2');
    const rsvps1 = [buildRsvp('user-1', 'rsvp-1')];
    const rsvps2 = [buildRsvp('user-2', 'rsvp-2'), buildRsvp('user-3', 'rsvp-3')];

    mockEventsService.getEventsStartingSoon.mockResolvedValue([event1, event2]);
    mockEventsService.getRsvpsForReminder
      .mockResolvedValueOnce(rsvps1)
      .mockResolvedValueOnce(rsvps2);
    mockEventsService.markReminderSent.mockResolvedValue(undefined);
    mockNotificationsService.sendEventReminders.mockResolvedValue(undefined);

    await scheduler.sendEventReminders();

    expect(mockNotificationsService.sendEventReminders).toHaveBeenCalledTimes(2);
    expect(mockEventsService.markReminderSent).toHaveBeenCalledWith(['rsvp-1']);
    expect(mockEventsService.markReminderSent).toHaveBeenCalledWith(['rsvp-2', 'rsvp-3']);
  });

  it('continues processing remaining events if one fails', async () => {
    const event1 = buildEvent('event-1');
    const event2 = buildEvent('event-2');

    mockEventsService.getEventsStartingSoon.mockResolvedValue([event1, event2]);
    mockEventsService.getRsvpsForReminder
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce([buildRsvp('user-2', 'rsvp-2')]);
    mockNotificationsService.sendEventReminders.mockResolvedValue(undefined);
    mockEventsService.markReminderSent.mockResolvedValue(undefined);

    await scheduler.sendEventReminders();

    // Second event still processed despite first one failing
    expect(mockNotificationsService.sendEventReminders).toHaveBeenCalledTimes(1);
    expect(mockEventsService.markReminderSent).toHaveBeenCalledTimes(1);
  });
});
