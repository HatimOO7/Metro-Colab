CREATE TABLE "kanban_boards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kanban_boards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE TABLE "kanban_columns" (
	"id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kanban_columns_board_id_kanban_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "kanban_boards"("id") ON DELETE cascade
);

CREATE TABLE "kanban_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"column_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" text NOT NULL,
	"priority" text DEFAULT 'Medium' NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sync_calendar" boolean DEFAULT false NOT NULL,
	"link_notes" boolean DEFAULT false NOT NULL,
	"calendar_item_id" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kanban_tasks_board_id_kanban_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "kanban_boards"("id") ON DELETE cascade,
	CONSTRAINT "kanban_tasks_column_id_kanban_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "kanban_columns"("id") ON DELETE cascade,
	CONSTRAINT "kanban_tasks_calendar_item_id_calendar_items_id_fk" FOREIGN KEY ("calendar_item_id") REFERENCES "calendar_items"("id") ON DELETE set null
);

CREATE INDEX "kanban_boards_user_idx" ON "kanban_boards" ("user_id");
CREATE INDEX "kanban_columns_board_position_idx" ON "kanban_columns" ("board_id", "position");
CREATE INDEX "kanban_tasks_board_idx" ON "kanban_tasks" ("board_id");
CREATE INDEX "kanban_tasks_column_position_idx" ON "kanban_tasks" ("column_id", "position");
CREATE INDEX "kanban_tasks_calendar_item_idx" ON "kanban_tasks" ("calendar_item_id");
