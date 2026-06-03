-- 0001_init.sql — Phase 1 initial migration
-- Sources: RESEARCH.md §1.2; schema.ts (this directory's sibling).

-- 1. Required extension. IF NOT EXISTS makes the migration idempotent.
-- Commented out: extensions must be created out-of-band by the postgres superuser in RDS.
-- CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint

-- 2. Drizzle-generated CREATE TABLE / TYPE / INDEX / FK statements for all 11 tables.
--    Generated via `pnpm drizzle-kit generate` from src/db/schema.ts.
CREATE TYPE "public"."build_flavor" AS ENUM('apkRollout', 'playStore', 'iosAppStore');--> statement-breakpoint
CREATE TYPE "public"."integrity_verdict" AS ENUM('passed', 'bypassed_apk');--> statement-breakpoint
CREATE TYPE "public"."qa_status" AS ENUM('pending', 'uploaded', 'verified', 'hash-mismatch', 'takedown');--> statement-breakpoint
CREATE TYPE "public"."task_setting" AS ENUM('indoor', 'outdoor', 'either');--> statement-breakpoint
CREATE TYPE "public"."task_request_status" AS ENUM('pending', 'reviewed', 'rejected', 'accepted');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_versions" (
	"flavor" "build_flavor" NOT NULL,
	"min_supported" text NOT NULL,
	"latest" text NOT NULL,
	"force_upgrade" boolean DEFAULT false NOT NULL,
	"apk_url" text,
	"apk_sha256" varchar(64),
	"play_store_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_versions_flavor_pk" PRIMARY KEY("flavor")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consent_log" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"user_id" varchar(26) NOT NULL,
	"consent_version" text NOT NULL,
	"consent_text_hash" varchar(64) NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"build_flavor" "build_flavor" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contributions" (
	"user_id" varchar(26) NOT NULL,
	"bucket_date" text NOT NULL,
	"duration_ms" bigint DEFAULT 0 NOT NULL,
	"recording_count" integer DEFAULT 0 NOT NULL,
	"task_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "contributions_user_id_bucket_date_pk" PRIMARY KEY("user_id","bucket_date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"user_id" varchar(26),
	"name" varchar(80) NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"flavor" "build_flavor",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"user_id" varchar(26) NOT NULL,
	"category" varchar(40) NOT NULL,
	"message" text NOT NULL,
	"diagnostic" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
	"user_id" varchar(26) NOT NULL,
	"key" varchar(64) NOT NULL,
	"method" varchar(10) NOT NULL,
	"path" text NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"status_code" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"user_id" varchar(26) PRIMARY KEY NOT NULL,
	"lifetime_contribution_ms" bigint DEFAULT 0 NOT NULL,
	"task_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recordings" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"user_id" varchar(26) NOT NULL,
	"task_id" varchar(26) NOT NULL,
	"practice" boolean DEFAULT false NOT NULL,
	"qa_status" "qa_status" DEFAULT 'pending' NOT NULL,
	"duration_ms" integer NOT NULL,
	"file_sha256" varchar(64) NOT NULL,
	"imu_sha256" varchar(64) NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"imu_size_bytes" bigint NOT NULL,
	"imu_video_drift_max_ms" integer,
	"imu_video_drift_mean_ms" integer,
	"imu_video_drift_p99_ms" integer,
	"imu_min_rate_hz_observed_p1" integer,
	"s3_key_video" text NOT NULL,
	"s3_key_imu" text NOT NULL,
	"s3_key_metadata" text NOT NULL,
	"liveness_score" integer,
	"captured_at" timestamp with time zone NOT NULL,
	"upload_started_at" timestamp with time zone,
	"upload_completed_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"flavor" "build_flavor" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_requests" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"user_id" varchar(26) NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(40) NOT NULL,
	"setting" "task_setting" NOT NULL,
	"sample_video_s3_key" text,
	"status" "task_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" varchar(40) NOT NULL,
	"setting" "task_setting" NOT NULL,
	"icon_key" text NOT NULL,
	"instructions" jsonb NOT NULL,
	"embedding" vector(384) NOT NULL,
	"name_search" "tsvector" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"google_sub" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"age" integer,
	"gender" text,
	"avatar_url" text,
	"consent_version" text NOT NULL,
	"consent_accepted_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"delete_grace_until" timestamp with time zone,
	"flavor" "build_flavor" NOT NULL,
	"application_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consent_log" ADD CONSTRAINT "consent_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contributions" ADD CONSTRAINT "contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recordings" ADD CONSTRAINT "recordings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recordings" ADD CONSTRAINT "recordings_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_requests" ADD CONSTRAINT "task_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consent_log_user_accepted_idx" ON "consent_log" USING btree ("user_id","accepted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_user_occurred_idx" ON "events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_name_idx" ON "events" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idempotency_expires_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recordings_user_captured_idx" ON "recordings" USING btree ("user_id","captured_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recordings_qa_status_idx" ON "recordings" USING btree ("qa_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recordings_task_idx" ON "recordings" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_slug_uniq" ON "tasks" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_category_idx" ON "tasks" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_sub_uniq" ON "users" USING btree ("google_sub");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_deleted_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint

-- 3. Generated tsvector column on tasks (Drizzle 0.45 has no DSL for GENERATED ALWAYS).
--    Postgres maintains automatically on insert/update.
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "name_search";--> statement-breakpoint
ALTER TABLE "tasks"
  ADD COLUMN "name_search" tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      coalesce("name", '') || ' ' || coalesce("description", '')
    )
  ) STORED;--> statement-breakpoint

-- 4. HNSW vector index for cosine similarity. Parameters per RESEARCH §1.2.
CREATE INDEX IF NOT EXISTS "tasks_embedding_hnsw_idx"
  ON "tasks"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);--> statement-breakpoint

-- 5. GIN index on the generated tsvector.
CREATE INDEX IF NOT EXISTS "tasks_name_search_gin_idx"
  ON "tasks"
  USING gin ("name_search");
