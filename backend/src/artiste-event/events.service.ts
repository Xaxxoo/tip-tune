import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThan, Repository } from 'typeorm';
import { ArtistEvent, EventRSVP } from './entities/artist-event.entity';
import {
  CreateEventDto,
  PaginatedResult,
  PaginationDto,
  RsvpDto,
  UpdateEventDto,
} from './dto/events.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(ArtistEvent)
    private readonly eventRepo: Repository<ArtistEvent>,
    @InjectRepository(EventRSVP)
    private readonly rsvpRepo: Repository<EventRSVP>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Event CRUD ────────────────────────────────────────────────────────────

  async createEvent(artistId: string, dto: CreateEventDto): Promise<ArtistEvent> {
    const startTime = new Date(dto.startTime);
    if (startTime <= new Date()) {
      throw new BadRequestException('Event start time must be in the future');
    }

    const endTime = dto.endTime ? new Date(dto.endTime) : null;
    if (endTime && endTime <= startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    const event = this.eventRepo.create({
      ...dto,
      artistId,
      startTime,
      endTime,
    });

    return this.eventRepo.save(event);
  }

  async getEventsByArtist(
    artistId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<ArtistEvent>> {
    const { page = 1, limit = 20 } = pagination;
    const [data, total] = await this.eventRepo.findAndCount({
      where: { artistId },
      order: { startTime: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResult(data, total, page, limit);
  }

  async getEvent(eventId: string): Promise<ArtistEvent> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async updateEvent(
    eventId: string,
    artistId: string,
    dto: UpdateEventDto,
  ): Promise<ArtistEvent> {
    const event = await this.getEvent(eventId);

    if (event.artistId !== artistId) {
      throw new ForbiddenException('You can only update your own events');
    }

    const startTime = dto.startTime ? new Date(dto.startTime) : event.startTime;
    const endTime = dto.endTime ? new Date(dto.endTime) : event.endTime;

    if (endTime && endTime <= startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    Object.assign(event, { ...dto, startTime, endTime });
    return this.eventRepo.save(event);
  }

  async deleteEvent(eventId: string, artistId: string): Promise<void> {
    const event = await this.getEvent(eventId);
    if (event.artistId !== artistId) {
      throw new ForbiddenException('You can only delete your own events');
    }
    await this.eventRepo.remove(event);
  }

  // ─── Feed ──────────────────────────────────────────────────────────────────

  async getFeed(
    followedArtistIds: string[],
    pagination: PaginationDto,
  ): Promise<PaginatedResult<ArtistEvent>> {
    const { page = 1, limit = 20 } = pagination;

    if (!followedArtistIds.length) {
      return new PaginatedResult([], 0, page, limit);
    }

    const [data, total] = await this.eventRepo.findAndCount({
      where: {
        artistId: In(followedArtistIds),
        startTime: MoreThan(new Date()),
      },
      order: { startTime: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResult(data, total, page, limit);
  }

  // ─── RSVP ─────────────────────────────────────────────────────────────────

  async rsvp(eventId: string, userId: string, dto: RsvpDto): Promise<EventRSVP> {
    const event = await this.getEvent(eventId);

    if (event.startTime <= new Date()) {
      throw new BadRequestException('Cannot RSVP to a past event');
    }

    const existing = await this.rsvpRepo.findOne({
      where: { eventId, userId },
    });

    if (existing) {
      throw new ConflictException('Already RSVPed to this event');
    }

    return this.dataSource.transaction(async (manager) => {
      const rsvp = manager.create(EventRSVP, {
        eventId,
        userId,
        reminderEnabled: dto.reminderEnabled ?? true,
      });

      await manager.save(rsvp);
      await manager
        .createQueryBuilder()
        .update(ArtistEvent)
        .set({ rsvpCount: () => 'rsvp_count + 1' })
        .where('id = :id', { id: eventId })
        .execute();

      return rsvp;
    });
  }

  async unRsvp(eventId: string, userId: string): Promise<void> {
    const rsvp = await this.rsvpRepo.findOne({ where: { eventId, userId } });
    if (!rsvp) throw new NotFoundException('RSVP not found');

    await this.dataSource.transaction(async (manager) => {
      await manager.remove(rsvp);
      await manager
        .createQueryBuilder()
        .update(ArtistEvent)
        .set({ rsvpCount: () => 'GREATEST(rsvp_count - 1, 0)' })
        .where('id = :id', { id: eventId })
        .execute();
    });
  }

  async getAttendees(
    eventId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<EventRSVP>> {
    await this.getEvent(eventId);

    const { page = 1, limit = 20 } = pagination;
    const [data, total] = await this.rsvpRepo.findAndCount({
      where: { eventId },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResult(data, total, page, limit);
  }

  // ─── Reminder cron support ────────────────────────────────────────────────

  async getEventsStartingSoon(): Promise<ArtistEvent[]> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const buffer = new Date(now.getTime() + 55 * 60 * 1000); // 55-min lower bound

    return this.eventRepo
      .createQueryBuilder('event')
      .where('event.start_time > :buffer AND event.start_time <= :oneHourFromNow', {
        buffer,
        oneHourFromNow,
      })
      .getMany();
  }

  async getRsvpsForReminder(eventId: string): Promise<EventRSVP[]> {
    return this.rsvpRepo.find({
      where: { eventId, reminderEnabled: true, reminderSent: false },
    });
  }

  async markReminderSent(rsvpIds: string[]): Promise<void> {
    if (!rsvpIds.length) return;
    await this.rsvpRepo.update({ id: In(rsvpIds) }, { reminderSent: true });
  }
}
