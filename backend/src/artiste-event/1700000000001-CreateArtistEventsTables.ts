import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateArtistEventsTables1700000000001 implements MigrationInterface {
  name = 'CreateArtistEventsTables1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type
    await queryRunner.query(`
      CREATE TYPE "event_type_enum" AS ENUM (
        'live_stream',
        'concert',
        'meet_greet',
        'album_release'
      )
    `);

    // Create artist_events table
    await queryRunner.query(`
      CREATE TABLE "artist_events" (
        "id"           UUID NOT NULL DEFAULT uuid_generate_v4(),
        "artist_id"    UUID NOT NULL,
        "title"        VARCHAR(255) NOT NULL,
        "description"  TEXT NOT NULL,
        "event_type"   "event_type_enum" NOT NULL,
        "start_time"   TIMESTAMPTZ NOT NULL,
        "end_time"     TIMESTAMPTZ,
        "venue"        VARCHAR(500),
        "stream_url"   VARCHAR(2048),
        "ticket_url"   VARCHAR(2048),
        "is_virtual"   BOOLEAN NOT NULL DEFAULT false,
        "rsvp_count"   INTEGER NOT NULL DEFAULT 0,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "pk_artist_events" PRIMARY KEY ("id")
      )
    `);

    // Indexes on artist_events
    await queryRunner.query(`
      CREATE INDEX "idx_artist_events_artist_id" ON "artist_events" ("artist_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_artist_events_start_time" ON "artist_events" ("start_time")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_artist_events_artist_start" ON "artist_events" ("artist_id", "start_time")
    `);

    // Create event_rsvps table
    await queryRunner.query(`
      CREATE TABLE "event_rsvps" (
        "id"               UUID NOT NULL DEFAULT uuid_generate_v4(),
        "event_id"         UUID NOT NULL,
        "user_id"          UUID NOT NULL,
        "reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
        "reminder_sent"    BOOLEAN NOT NULL DEFAULT false,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "pk_event_rsvps" PRIMARY KEY ("id"),
        CONSTRAINT "uq_event_rsvps_event_user" UNIQUE ("event_id", "user_id"),
        CONSTRAINT "fk_event_rsvps_event"
          FOREIGN KEY ("event_id")
          REFERENCES "artist_events" ("id")
          ON DELETE CASCADE
      )
    `);

    // Indexes on event_rsvps
    await queryRunner.query(`
      CREATE INDEX "idx_event_rsvps_event_id" ON "event_rsvps" ("event_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_event_rsvps_user_id" ON "event_rsvps" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_event_rsvps_reminder"
        ON "event_rsvps" ("reminder_enabled", "reminder_sent")
        WHERE reminder_enabled = true AND reminder_sent = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "event_rsvps"`);
    await queryRunner.query(`DROP TABLE "artist_events"`);
    await queryRunner.query(`DROP TYPE "event_type_enum"`);
  }
}
