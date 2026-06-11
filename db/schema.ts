import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";


export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  name: text("name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").notNull().unique(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const calendarItems = pgTable("calendar_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  itemType: text("item_type").notNull().default("task"),
  category: text("category").notNull(),
  categoryColor: text("category_color").notNull(),
  scheduledDate: text("scheduled_date"),
  scheduledTime: text("scheduled_time"),
  status: text("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CalendarItem = typeof calendarItems.$inferSelect;
export type NewCalendarItem = typeof calendarItems.$inferInsert;

export type KanbanLabel = {
  name: string;
  color: string;
};

export const kanbanBoards = pgTable(
  "kanban_boards",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    sharedEmails: jsonb("shared_emails").$type<string[]>().notNull().default([]),
    pendingEmails: jsonb("pending_emails").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("kanban_boards_user_idx").on(table.userId)]
);

export type KanbanBoard = typeof kanbanBoards.$inferSelect;
export type NewKanbanBoard = typeof kanbanBoards.$inferInsert;

export const kanbanColumns = pgTable(
  "kanban_columns",
  {
    id: serial("id").primaryKey(),
    boardId: integer("board_id")
      .notNull()
      .references(() => kanbanBoards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("kanban_columns_board_position_idx").on(table.boardId, table.position)]
);

export type KanbanColumn = typeof kanbanColumns.$inferSelect;
export type NewKanbanColumn = typeof kanbanColumns.$inferInsert;

export const kanbanTasks = pgTable(
  "kanban_tasks",
  {
    id: serial("id").primaryKey(),
    boardId: integer("board_id")
      .notNull()
      .references(() => kanbanBoards.id, { onDelete: "cascade" }),
    columnId: integer("column_id")
      .notNull()
      .references(() => kanbanColumns.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: text("due_date").notNull(),
    priority: text("priority").notNull().default("Medium"),
    labels: jsonb("labels").$type<KanbanLabel[]>().notNull().default([]),
    syncCalendar: boolean("sync_calendar").notNull().default(false),
    linkNotes: boolean("link_notes").notNull().default(false),
    calendarItemId: integer("calendar_item_id").references(() => calendarItems.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("kanban_tasks_board_idx").on(table.boardId),
    index("kanban_tasks_column_position_idx").on(table.columnId, table.position),
    index("kanban_tasks_calendar_item_idx").on(table.calendarItemId),
  ]
);

export type KanbanTask = typeof kanbanTasks.$inferSelect;
export type NewKanbanTask = typeof kanbanTasks.$inferInsert;

export const notes = pgTable(
  "notes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled"),
    content: text("content").notNull().default(""),
    icon: text("icon").notNull().default("📄"),
    color: text("color").notNull().default("amber"),
    isPinned: boolean("is_pinned").notNull().default(false),
    isTrash: boolean("is_trash").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("notes_user_idx").on(table.userId),
    index("notes_is_trash_idx").on(table.isTrash),
  ]
);

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

export const whiteboards = pgTable(
  "whiteboards",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    sharedEmails: jsonb("shared_emails").$type<string[]>().notNull().default([]),
    pendingEmails: jsonb("pending_emails").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("whiteboards_user_idx").on(table.userId)]
);

export type Whiteboard = typeof whiteboards.$inferSelect;
export type NewWhiteboard = typeof whiteboards.$inferInsert;

// ── Pages & Spaces ───────────────────────────────────────────────────────────

export const spaces = pgTable(
  "spaces",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color").notNull().default("indigo"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    archivedAt: timestamp("archived_at"),
    sharedEmails: jsonb("shared_emails").$type<string[]>().notNull().default([]),
    pendingEmails: jsonb("pending_emails").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("spaces_user_idx").on(table.userId),
    index("spaces_is_archived_idx").on(table.isArchived),
  ]
);

export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;

export const pages = pgTable(
  "pages",
  {
    id: serial("id").primaryKey(),
    spaceId: integer("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastEditedByUserId: integer("last_edited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull().default("Untitled Page"),
    template: text("template").notNull().default("Blank Page"),
    description: text("description"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    archivedAt: timestamp("archived_at"),
    commentsCount: integer("comments_count").notNull().default(0),
    linkedTasksCount: integer("linked_tasks_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("pages_space_idx").on(table.spaceId),
    index("pages_user_idx").on(table.userId),
    index("pages_is_archived_idx").on(table.isArchived),
  ]
);

export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;

export const spaceMembers = pgTable(
  "space_members",
  {
    id: serial("id").primaryKey(),
    spaceId: integer("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    index("space_members_space_idx").on(table.spaceId),
    index("space_members_user_idx").on(table.userId),
  ]
);

export type SpaceMember = typeof spaceMembers.$inferSelect;
export type NewSpaceMember = typeof spaceMembers.$inferInsert;

export const spaceInvitations = pgTable(
  "space_invitations",
  {
    id: serial("id").primaryKey(),
    spaceId: integer("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    invitedBy: integer("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invitedEmail: text("invited_email").notNull(),
    invitedUserId: integer("invited_user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("space_invitations_space_idx").on(table.spaceId),
    index("space_invitations_email_idx").on(table.invitedEmail),
    index("space_invitations_status_idx").on(table.status),
  ]
);

export type SpaceInvitation = typeof spaceInvitations.$inferSelect;
export type NewSpaceInvitation = typeof spaceInvitations.$inferInsert;

export const pageComments = pgTable(
  "page_comments",
  {
    id: serial("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("page_comments_page_idx").on(table.pageId)]
);

export type PageComment = typeof pageComments.$inferSelect;
export type NewPageComment = typeof pageComments.$inferInsert;

export const pageTaskLinks = pgTable(
  "page_task_links",
  {
    id: serial("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    taskId: integer("task_id")
      .notNull()
      .references(() => kanbanTasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("page_task_links_page_idx").on(table.pageId),
    index("page_task_links_task_idx").on(table.taskId),
  ]
);

export type PageTaskLink = typeof pageTaskLinks.$inferSelect;
export type NewPageTaskLink = typeof pageTaskLinks.$inferInsert;

export const pageFiles = pgTable(
  "page_files",
  {
    id: serial("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    data: text("data").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("page_files_page_idx").on(table.pageId)]
);

export type PageFile = typeof pageFiles.$inferSelect;
export type NewPageFile = typeof pageFiles.$inferInsert;

// ── AI Template Builder (Schema-Driven) ───────────────────────────────────────

export type EntityFieldSchema = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean" | "textarea";
  required: boolean;
  options?: string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
};

export type EntitySchema = {
  name: string;
  label: string;
  fields: EntityFieldSchema[];
};

export type FormFieldSchema = {
  name: string;
  label?: string;
  type: "text" | "number" | "date" | "select" | "boolean" | "textarea";
  placeholder?: string;
  required?: boolean;
};

export type FormSchema = {
  id: string;
  title: string;
  entity: string;
  fields: FormFieldSchema[];
};

export type WidgetItemSchema = {
  label: string;
  valueType: "count" | "sum" | "avg" | "max" | "min";
  field?: string;
  filter?: Record<string, unknown>;
};

export type WidgetSchema = {
  id: string;
  type: "stats" | "progress" | "list" | "table";
  title: string;
  entity: string;
  // stats
  items?: WidgetItemSchema[];
  // progress
  calculate?: "percentage" | "sum_target";
  targetField?: string;
  filterField?: string;
  targetValue?: number;
  // list/table
  searchable?: boolean;
  filterable?: boolean;
  filterFields?: string[];
  displayFields?: string[];
  actions?: string[];
};

export type ActionSchema = {
  id: string;
  label: string;
  type: "create" | "update" | "delete";
  entity: string;
  fields?: Record<string, unknown>;
};

export type AiTemplateJson = {
  appName: string;
  description: string;
  icon: string;
  color: string;
  entities: EntitySchema[];
  forms: FormSchema[];
  widgets: WidgetSchema[];
  actions: ActionSchema[];
  sampleData: Record<string, unknown[]>;
};

export const aiTemplates = pgTable(
  "ai_templates",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    appName: text("app_name").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("Sparkles"),
    color: text("color").notNull().default("#6366F1"),
    appJson: jsonb("app_json").$type<AiTemplateJson>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("ai_templates_user_idx").on(table.userId)]
);

export type AiTemplate = typeof aiTemplates.$inferSelect;
export type NewAiTemplate = typeof aiTemplates.$inferInsert;

export const aiTemplateSidebarPins = pgTable(
  "ai_template_sidebar_pins",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: integer("template_id")
      .notNull()
      .references(() => aiTemplates.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    pinnedAt: timestamp("pinned_at").defaultNow().notNull(),
  },
  (table) => [
    index("ai_sidebar_pins_user_idx").on(table.userId),
    index("ai_sidebar_pins_template_idx").on(table.templateId),
  ]
);

export type AiTemplateSidebarPin = typeof aiTemplateSidebarPins.$inferSelect;
export type NewAiTemplateSidebarPin = typeof aiTemplateSidebarPins.$inferInsert;

export const aiTemplateRecords = pgTable(
  "ai_template_records",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: integer("template_id")
      .notNull()
      .references(() => aiTemplates.id, { onDelete: "cascade" }),
    entityName: text("entity_name").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("ai_template_records_user_template_idx").on(table.userId, table.templateId),
    index("ai_template_records_entity_idx").on(table.entityName),
  ]
);

export type AiTemplateRecord = typeof aiTemplateRecords.$inferSelect;
export type NewAiTemplateRecord = typeof aiTemplateRecords.$inferInsert;

