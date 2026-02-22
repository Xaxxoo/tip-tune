import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ArtistEvent, EventRSVP } from './entities/artist-event.entity';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventsScheduler } from './events.scheduler';
import { FollowsModule } from '../follows/follows.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ArtistEvent, EventRSVP]),
    ScheduleModule.forRoot(),
    FollowsModule,
    NotificationsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService, EventsScheduler],
  exports: [EventsService],
})
export class EventsModule {}
