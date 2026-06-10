CREATE TABLE IF NOT EXISTS "spaces" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "color" text DEFAULT 'indigo' NOT NULL,
  "is_favorite" boolean DEFAULT false NOT NULL,
  "is_archived" boolean DEFAULT false NOT NULL,
  "archived_at" timestamp,
  "shared_emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "pending_emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spaces_user_idx" ON "spaces" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spaces_is_archived_idx" ON "spaces" ("is_archived");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pages" (
  "id" serial PRIMARY KEY NOT NULL,
  "space_id" integer NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "last_edited_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "title" text DEFAULT 'Untitled Page' NOT NULL,
  "template" text DEFAULT 'Blank Page' NOT NULL,
  "description" text,
  "is_favorite" boolean DEFAULT false NOT NULL,
  "is_archived" boolean DEFAULT false NOT NULL,
  "archived_at" timestamp,
  "comments_count" integer DEFAULT 0 NOT NULL,
  "linked_tasks_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pages_space_idx" ON "pages" ("space_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pages_user_idx" ON "pages" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pages_is_archived_idx" ON "pages" ("is_archived");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "space_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "space_id" integer NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_members_space_idx" ON "space_members" ("space_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_members_user_idx" ON "space_members" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "space_members_space_user_unique" ON "space_members" ("space_id", "user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "space_invitations" (
  "id" serial PRIMARY KEY NOT NULL,
  "space_id" integer NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
  "invited_by" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "invited_email" text NOT NULL,
  "invited_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_invitations_space_idx" ON "space_invitations" ("space_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_invitations_email_idx" ON "space_invitations" ("invited_email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_invitations_status_idx" ON "space_invitations" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "page_comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "page_id" integer NOT NULL REFERENCES "pages"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_comments_page_idx" ON "page_comments" ("page_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "page_task_links" (
  "id" serial PRIMARY KEY NOT NULL,
  "page_id" integer NOT NULL REFERENCES "pages"("id") ON DELETE CASCADE,
  "task_id" integer NOT NULL REFERENCES "kanban_tasks"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_task_links_page_idx" ON "page_task_links" ("page_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_task_links_task_idx" ON "page_task_links" ("task_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "page_task_links_unique" ON "page_task_links" ("page_id", "task_id");
--> statement-breakpoint
-- Backfill owner memberships for existing spaces
INSERT INTO "space_members" ("space_id", "user_id", "role")
SELECT s.id, s.user_id, 'owner'
FROM "spaces" s
WHERE NOT EXISTS (
  SELECT 1 FROM "space_members" sm
  WHERE sm.space_id = s.id AND sm.user_id = s.user_id
);
