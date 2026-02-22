import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsService } from './events.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EventsScheduler {
  private readonly logger = new Logger(EventsScheduler.name);

  constructor(
    private readonly eventsService: EventsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Runs every 5 minutes and sends reminders for events starting within the next hour.
   * Uses a 55-minute lower bound to avoid double-sending across cron runs.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendEventReminders(): Promise<void> {
    this.logger.log('Running event reminder cron job...');

    const upcomingEvents = await this.eventsService.getEventsStartingSoon();

    if (!upcomingEvents.length) {
      this.logger.debug('No events starting soon');
      return;
    }

    let totalSent = 0;

    for (const event of upcomingEvents) {
      try {
        const rsvps = await this.eventsService.getRsvpsForReminder(event.id);

        if (!rsvps.length) continue;

        const userIds = rsvps.map((r) => r.userId);
        const rsvpIds = rsvps.map((r) => r.id);

        await this.notificationsService.sendEventReminders(userIds, event);
        await this.eventsService.markReminderSent(rsvpIds);

        totalSent += userIds.length;
        this.logger.log(
          `Sent ${userIds.length} reminders for event "${event.title}" (${event.id})`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to process reminders for event ${event.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(`Event reminder cron complete. Total reminders sent: ${totalSent}`);
  }
}
