import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto, PaginationDto, RsvpDto, UpdateEventDto } from './dto/events.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ArtistGuard } from './guards/artist.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FollowsService } from '../follows/follows.service';

@Controller('api/events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly followsService: FollowsService,
  ) {}

  // ─── Create event (artist only) ───────────────────────────────────────────

  @Post()
  @UseGuards(ArtistGuard)
  createEvent(
    @CurrentUser('artistId') artistId: string,
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.createEvent(artistId, dto);
  }

  // ─── List events by artist ────────────────────────────────────────────────

  @Get('artist/:artistId')
  getEventsByArtist(
    @Param('artistId', ParseUUIDPipe) artistId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.eventsService.getEventsByArtist(artistId, pagination);
  }

  // ─── Feed: upcoming events from followed artists ──────────────────────────

  @Get('feed')
  async getFeed(
    @CurrentUser('sub') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    const followedArtistIds = await this.followsService.getFollowedArtistIds(userId);
    return this.eventsService.getFeed(followedArtistIds, pagination);
  }

  // ─── Get single event ─────────────────────────────────────────────────────

  @Get(':eventId')
  getEvent(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.eventsService.getEvent(eventId);
  }

  // ─── Update event ─────────────────────────────────────────────────────────

  @Patch(':eventId')
  @UseGuards(ArtistGuard)
  updateEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser('artistId') artistId: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.updateEvent(eventId, artistId, dto);
  }

  // ─── Delete event ─────────────────────────────────────────────────────────

  @Delete(':eventId')
  @UseGuards(ArtistGuard)
  deleteEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser('artistId') artistId: string,
  ) {
    return this.eventsService.deleteEvent(eventId, artistId);
  }

  // ─── RSVP ─────────────────────────────────────────────────────────────────

  @Post(':eventId/rsvp')
  rsvp(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: RsvpDto,
  ) {
    return this.eventsService.rsvp(eventId, userId, dto);
  }

  @Delete(':eventId/rsvp')
  unRsvp(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.eventsService.unRsvp(eventId, userId);
  }

  // ─── Attendees ────────────────────────────────────────────────────────────

  @Get(':eventId/attendees')
  getAttendees(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.eventsService.getAttendees(eventId, pagination);
  }
}
