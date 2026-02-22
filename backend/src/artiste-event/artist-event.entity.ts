import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

export enum EventType {
  LIVE_STREAM = 'live_stream',
  CONCERT = 'concert',
  MEET_GREET = 'meet_greet',
  ALBUM_RELEASE = 'album_release',
}

@Entity('artist_events')
@Index(['artistId', 'startTime'])
@Index(['startTime'])
export class ArtistEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'artist_id' })
  @Index()
  artistId: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: EventType,
  })
  eventType: EventType;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime: Date | null;

  @Column({ length: 500, nullable: true })
  venue: string | null;

  @Column({ name: 'stream_url', length: 2048, nullable: true })
  streamUrl: string | null;

  @Column({ name: 'ticket_url', length: 2048, nullable: true })
  ticketUrl: string | null;

  @Column({ name: 'is_virtual', default: false })
  isVirtual: boolean;

  @Column({ name: 'rsvp_count', default: 0 })
  rsvpCount: number;

  @OneToMany(() => EventRSVP, (rsvp) => rsvp.event)
  rsvps: EventRSVP[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('event_rsvps')
@Index(['eventId', 'userId'], { unique: true })
export class EventRSVP {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id' })
  @Index()
  eventId: string;

  @ManyToOne(() => ArtistEvent, (event) => event.rsvps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: ArtistEvent;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'reminder_enabled', default: true })
  reminderEnabled: boolean;

  @Column({ name: 'reminder_sent', default: false })
  reminderSent: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
