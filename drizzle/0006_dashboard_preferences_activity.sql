CREATE TABLE IF NOT EXISTS "user_preferences" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "preferences" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "scope" text NOT NULL,
  "name" text NOT NULL,
  "color" text NOT NULL,
  "icon" text DEFAULT 'Tag' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "activity_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "type" text NOT NULL,
  "module" text NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" integer,
  "title" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "resource_views" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" integer NOT NULL,
  "title" text NOT NULL,
  "module" text NOT NULL,
  "last_viewed_at" timestamp DEFAULT now() NOT NULL,
  "last_edited_at" timestamp
);

DO $$ BEGIN
 ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_categories" ADD CONSTRAINT "user_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "resource_views" ADD CONSTRAINT "resource_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_user_idx" ON "user_preferences" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "user_categories_user_scope_idx" ON "user_categories" USING btree ("user_id","scope");
CREATE UNIQUE INDEX IF NOT EXISTS "user_categories_unique_name_idx" ON "user_categories" USING btree ("user_id","scope","name");
CREATE INDEX IF NOT EXISTS "activity_events_user_created_idx" ON "activity_events" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "activity_events_resource_idx" ON "activity_events" USING btree ("resource_type","resource_id");
CREATE INDEX IF NOT EXISTS "resource_views_user_recent_idx" ON "resource_views" USING btree ("user_id","last_viewed_at");
CREATE UNIQUE INDEX IF NOT EXISTS "resource_views_unique_resource_idx" ON "resource_views" USING btree ("user_id","resource_type","resource_id");
