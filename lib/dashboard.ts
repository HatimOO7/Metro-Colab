import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  activityEvents,
  aiTemplates,
  calendarItems,
  db,
  kanbanBoards,
  kanbanColumns,
  kanbanTasks,
  notes,
  pages,
  resourceViews,
  spaceInvitations,
  spaceMembers,
  spaces,
  userCategories,
  userPreferences,
  users,
  whiteboards,
  type UserPreferencesData,
} from "@/db";
import { getAuthenticatedDbUser } from "@/lib/api-auth";
import { getBoardsWithDetails } from "@/lib/kanban";
import { getPendingInvitationsForUser, getSpaceMembers, getSpacesForUser } from "@/lib/spaces";
import { getWhiteboardsForUser } from "@/lib/whiteboard";

export const categoryScopes = ["calendar", "task", "note", "reminder"] as const;
export type CategoryScope = (typeof categoryScopes)[number];

export const defaultPreferences: UserPreferencesData = {
  theme: "system",
  notifications: true,
  defaultCalendarView: "month",
  defaultTaskPriority: "Medium",
  autoSave: true,
  privacy: {
    showProfileToCollaborators: true,
    allowUserSearch: true,
  },
};

const defaultCategories: Array<{ scope: CategoryScope; name: string; color: string; icon: string }> = [
  { scope: "calendar", name: "Work", color: "sky", icon: "Briefcase" },
  { scope: "calendar", name: "Meeting", color: "emerald", icon: "UsersRound" },
  { scope: "task", name: "Focus", color: "violet", icon: "Target" },
  { scope: "task", name: "Urgent", color: "rose", icon: "Flame" },
  { scope: "note", name: "Research", color: "amber", icon: "FileText" },
  { scope: "reminder", name: "Personal", color: "coral", icon: "Bell" },
];

type AuthContext = NonNullable<Awaited<ReturnType<typeof getAuthenticatedDbUser>>>;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function mergePreferences(input: Partial<UserPreferencesData> | null | undefined): UserPreferencesData {
  return {
    ...defaultPreferences,
    ...(input ?? {}),
    privacy: {
      ...defaultPreferences.privacy,
      ...(input?.privacy ?? {}),
    },
  };
}

export async function requireDashboardAuth() {
  const auth = await getAuthenticatedDbUser();
  return auth;
}

export async function getOrCreatePreferences(userId: number) {
  const existing = await db.query.userPreferences.findFirst({ where: eq(userPreferences.userId, userId) });
  if (existing) return mergePreferences(existing.preferences);

  const [created] = await db
    .insert(userPreferences)
    .values({ userId, preferences: defaultPreferences, updatedAt: new Date() })
    .returning();
  return mergePreferences(created?.preferences);
}

export async function updatePreferences(userId: number, patch: Partial<UserPreferencesData>) {
  const existing = await db.query.userPreferences.findFirst({ where: eq(userPreferences.userId, userId) });
  const currentPrefs = existing ? mergePreferences(existing.preferences) : defaultPreferences;
  const next = mergePreferences({ ...currentPrefs, ...patch });

  const [saved] = await db
    .insert(userPreferences)
    .values({ userId, preferences: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { preferences: next, updatedAt: new Date() },
    })
    .returning();
  return mergePreferences(saved?.preferences);
}

export async function ensureDefaultCategories(userId: number) {
  const existing = await db.select().from(userCategories).where(eq(userCategories.userId, userId));
  if (existing.length > 0) return existing;

  await db.insert(userCategories).values(defaultCategories.map((category) => ({ userId, ...category })));
  return db.select().from(userCategories).where(eq(userCategories.userId, userId));
}

export function normalizeCategoryScope(value: unknown): CategoryScope | null {
  return typeof value === "string" && (categoryScopes as readonly string[]).includes(value)
    ? (value as CategoryScope)
    : null;
}

export async function logActivity(input: {
  userId: number;
  type: string;
  module: string;
  resourceType: string;
  resourceId?: number | null;
  title: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(activityEvents).values({
    userId: input.userId,
    type: input.type,
    module: input.module,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    title: input.title,
    metadata: input.metadata ?? {},
  });
}

export async function upsertResourceView(input: {
  userId: number;
  resourceType: string;
  resourceId: number;
  title: string;
  module: string;
  edited?: boolean;
}) {
  const now = new Date();
  await db
    .insert(resourceViews)
    .values({
      userId: input.userId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      title: input.title,
      module: input.module,
      lastViewedAt: now,
      lastEditedAt: input.edited ? now : null,
    })
    .onConflictDoUpdate({
      target: [resourceViews.userId, resourceViews.resourceType, resourceViews.resourceId],
      set: {
        title: input.title,
        module: input.module,
        lastViewedAt: now,
        lastEditedAt: input.edited ? now : sql`coalesce(${resourceViews.lastEditedAt}, ${now})`,
      },
    });
}

async function getAccessibleSpaceIds(userId: number, email: string) {
  const accessibleSpaces = await getSpacesForUser(userId, email);
  return accessibleSpaces.map((space) => space.id);
}

async function getPendingKanbanInvitations(email: string) {
  return db
    .select({ board: kanbanBoards, ownerEmail: users.email })
    .from(kanbanBoards)
    .innerJoin(users, eq(kanbanBoards.userId, users.id))
    .where(sql`${kanbanBoards.pendingEmails} @> ${JSON.stringify([email])}::jsonb`);
}

async function getPendingWhiteboardInvitations(email: string) {
  return db
    .select({ board: whiteboards, ownerEmail: users.email, ownerName: users.name })
    .from(whiteboards)
    .innerJoin(users, eq(whiteboards.userId, users.id))
    .where(sql`${whiteboards.pendingEmails} @> ${JSON.stringify([email])}::jsonb`);
}

export async function getDashboardData(auth: AuthContext) {
  const userId = auth.dbUser.id;
  const email = normalizeEmail(auth.email);

  const [
    preferences,
    categories,
    boards,
    whiteboardRows,
    spaceRows,
    userNotes,
    templates,
    calendarRows,
    activityRows,
    viewRows,
    pendingSpaces,
    pendingKanban,
    pendingWhiteboards
  ] = await Promise.all([
    getOrCreatePreferences(userId),
    ensureDefaultCategories(userId),
    getBoardsWithDetails(userId, email),
    getWhiteboardsForUser(userId, email),
    getSpacesForUser(userId, email),
    db.select().from(notes).where(and(eq(notes.userId, userId), eq(notes.isTrash, false))).orderBy(desc(notes.updatedAt)),
    db.select().from(aiTemplates).where(eq(aiTemplates.userId, userId)).orderBy(desc(aiTemplates.updatedAt)),
    db.select().from(calendarItems).where(eq(calendarItems.userId, userId)).orderBy(desc(calendarItems.updatedAt)),
    db.select().from(activityEvents).where(eq(activityEvents.userId, userId)).orderBy(desc(activityEvents.createdAt)).limit(20),
    db.select().from(resourceViews).where(eq(resourceViews.userId, userId)).orderBy(desc(resourceViews.lastViewedAt)).limit(20),
    getPendingInvitationsForUser(email),
    getPendingKanbanInvitations(email),
    getPendingWhiteboardInvitations(email),
  ]);

  const spaceIds = spaceRows.map((space) => space.id);
  const pageRows =
    spaceIds.length > 0
      ? await db.select().from(pages).where(and(inArray(pages.spaceId, spaceIds), eq(pages.isArchived, false))).orderBy(desc(pages.updatedAt))
      : [];

  const allTasks = boards.flatMap((board) =>
  board.columns.flatMap((column: typeof kanbanColumns.$inferSelect & { tasks: any[] }) =>
    column.tasks.map((task: typeof kanbanTasks.$inferSelect) => ({
      ...task,
      boardName: board.name,
      columnName: column.name,
      completed: /done|complete|closed/i.test(column.name),
    }))
  )
);

  const overdueTasks = allTasks.filter((task) => task.dueDate && task.dueDate < todayKey() && !task.completed);
  const completedTasks = allTasks.filter((task) => task.completed);
  const scheduledItems = calendarRows.filter((item) => item.status === "scheduled" && item.scheduledDate);
  const reminders = calendarRows.filter((item) => item.itemType === "reminder");

  const derivedActivity = [
    ...calendarRows.map((item) => ({
      id: `calendar-${item.id}`,
      type: item.status === "draft" ? "drafted" : "scheduled",
      module: "Calendar",
      resourceType: item.itemType,
      resourceId: item.id,
      title: item.title,
      createdAt: toIso(item.updatedAt),
    })),
    ...allTasks.map((task) => ({
      id: `task-${task.id}`,
      type: task.completed ? "completed" : "updated",
      module: "Tasks",
      resourceType: "task",
      resourceId: task.id,
      title: task.title,
      createdAt: toIso(task.updatedAt),
    })),
    ...userNotes.map((note) => ({
      id: `note-${note.id}`,
      type: "edited",
      module: "Notes",
      resourceType: "note",
      resourceId: note.id,
      title: note.title,
      createdAt: toIso(note.updatedAt),
    })),
    ...whiteboardRows.map((board) => ({
      id: `whiteboard-${board.id}`,
      type: "updated",
      module: "Whiteboards",
      resourceType: "whiteboard",
      resourceId: board.id,
      title: board.name,
      createdAt: toIso(board.updatedAt),
    })),
    ...pageRows.map((page) => ({
      id: `page-${page.id}`,
      type: "edited",
      module: "Pages",
      resourceType: "page",
      resourceId: page.id,
      title: page.title,
      createdAt: toIso(page.updatedAt),
    })),
    ...templates.map((template) => ({
      id: `template-${template.id}`,
      type: "updated",
      module: "Templates",
      resourceType: "template",
      resourceId: template.id,
      title: template.appName,
      createdAt: toIso(template.updatedAt),
    })),
  ]
    .filter((item) => item.createdAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const recentActivity = [
    ...activityRows.map((event) => ({
      id: `event-${event.id}`,
      type: event.type,
      module: event.module,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      title: event.title,
      createdAt: toIso(event.createdAt),
    })),
    ...derivedActivity,
  ].slice(0, 12);

  // Time filter variables for Upcoming Schedule
  const currentDateStr = todayKey();
  const now = new Date();
  const currentHourMinute = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const upcomingSchedule = [
    ...scheduledItems.map((item) => ({
      id: `calendar-${item.id}`,
      title: item.title,
      date: item.scheduledDate,
      time: item.scheduledTime,
      categoryColor: item.categoryColor,
      type: item.itemType,
    })),
    ...allTasks
      .filter((task) => task.dueDate && !task.completed)
      .map((task) => ({
        id: `task-${task.id}`,
        title: task.title,
        date: task.dueDate,
        time: null,
        categoryColor: task.priority === "High" ? "rose" : task.priority === "Low" ? "violet" : "sky",
        type: "deadline",
      })),
  ]
    .filter((item) => {
      if (!item.date) return false;
      if (item.date < currentDateStr) return false;
      // If the event is today and has a time, filter out if that time has passed
      if (item.date === currentDateStr && item.time) {
        return item.time > currentHourMinute;
      }
      return true;
    })
    .sort((a, b) => `${a.date ?? ""}${a.time ?? ""}`.localeCompare(`${b.date ?? ""}${b.time ?? ""}`))
    .slice(0, 8);

  const fallbackResources = [
    ...userNotes.map((note) => ({ id: `note-${note.id}`, resourceType: "note", resourceId: note.id, title: note.title, module: "Notes", lastViewedAt: toIso(note.updatedAt), lastEditedAt: toIso(note.updatedAt) })),
    ...whiteboardRows.map((board) => ({ id: `whiteboard-${board.id}`, resourceType: "whiteboard", resourceId: board.id, title: board.name, module: "Whiteboards", lastViewedAt: toIso(board.updatedAt), lastEditedAt: toIso(board.updatedAt) })),
    ...boards.map((board) => ({ id: `board-${board.id}`, resourceType: "board", resourceId: board.id, title: board.name, module: "Tasks", lastViewedAt: toIso(board.updatedAt), lastEditedAt: toIso(board.updatedAt) })),
    ...templates.map((template) => ({ id: `template-${template.id}`, resourceType: "template", resourceId: template.id, title: template.appName, module: "Templates", lastViewedAt: toIso(template.updatedAt), lastEditedAt: toIso(template.updatedAt) })),
  ].sort((a, b) => String(b.lastViewedAt).localeCompare(String(a.lastViewedAt)));

  const recentResources = [
    ...viewRows.map((view) => ({
      id: `view-${view.id}`,
      resourceType: view.resourceType,
      resourceId: view.resourceId,
      title: view.title,
      module: view.module,
      lastViewedAt: toIso(view.lastViewedAt),
      lastEditedAt: toIso(view.lastEditedAt),
    })),
    ...fallbackResources,
  ].slice(0, 8);

  // Fetch collaboration data earlier to use its length for consistent stats
  const collaborationData = await getCollaborationData(auth, {
    boards,
    whiteboardRows,
    spaceRows,
    pendingSpaces,
    pendingKanban,
    pendingWhiteboards,
  });

  return {
    profile: {
      id: userId,
      name: auth.dbUser.name ?? auth.clerkUser.fullName ?? auth.email,
      email,
      imageUrl: auth.dbUser.imageUrl ?? auth.clerkUser.imageUrl,
      createdAt: toIso(auth.dbUser.createdAt),
    },
    preferences,
    categories,
    stats: {
      calendarItems: calendarRows.length,
      reminders: reminders.length,
      taskBoards: boards.length,
      tasks: allTasks.length,
      notes: userNotes.length,
      whiteboards: whiteboardRows.length,
      templates: templates.length,
      spaces: spaceRows.length,
      pages: pageRows.length,
      collaborations: collaborationData.resources.length, // Renamed key to 'collaborations' and using accurate data length
      pendingInvitations: pendingSpaces.length + pendingKanban.length + pendingWhiteboards.length,
    },
    featureMetrics: [
      { key: "calendar", label: "Calendar", value: scheduledItems.length, detail: `${reminders.length} reminders` },
      { key: "tasks", label: "Tasks / Kanban", value: allTasks.length, detail: `${boards.length} boards` },
      { key: "notes", label: "Notes", value: userNotes.length, detail: `${userNotes.filter((note) => note.isPinned).length} pinned` },
      { key: "whiteboards", label: "Whiteboards", value: whiteboardRows.length, detail: `${whiteboardRows.filter((board) => board.userId !== userId).length} shared` },
      { key: "templates", label: "Templates", value: templates.length, detail: "Custom apps" },
      { key: "collaboration", label: "Collaborations", value: collaborationData.resources.length, detail: `${pendingSpaces.length + pendingKanban.length + pendingWhiteboards.length} pending` },
    ],
    taskAnalytics: {
      total: allTasks.length,
      completed: completedTasks.length,
      pending: allTasks.length - completedTasks.length,
      overdue: overdueTasks.length,
      progress: allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0,
    },
    recentActivity,
    upcomingSchedule,
    recentResources,
    collaboration: collaborationData,
  };
}

export async function getActivityData(userId: number) {
  return db.select().from(activityEvents).where(eq(activityEvents.userId, userId)).orderBy(desc(activityEvents.createdAt)).limit(50);
}

export async function getCollaborationData(
  auth: AuthContext,
  prefetched?: {
    boards: any[];
    whiteboardRows: any[];
    spaceRows: any[];
    pendingSpaces: any[];
    pendingKanban: any[];
    pendingWhiteboards: any[];
  }
) {
  const userId = auth.dbUser.id;
  const email = normalizeEmail(auth.email);

  let boards, whiteboardRows, spaceRows, pendingSpaces, pendingKanban, pendingWhiteboards;

  if (prefetched) {
    boards = prefetched.boards;
    whiteboardRows = prefetched.whiteboardRows;
    spaceRows = prefetched.spaceRows;
    pendingSpaces = prefetched.pendingSpaces;
    pendingKanban = prefetched.pendingKanban;
    pendingWhiteboards = prefetched.pendingWhiteboards;
  } else {
    const [b, w, s, ps, pk, pw] = await Promise.all([
      getBoardsWithDetails(userId, email),
      getWhiteboardsForUser(userId, email),
      getSpacesForUser(userId, email),
      getPendingInvitationsForUser(email),
      getPendingKanbanInvitations(email),
      getPendingWhiteboardInvitations(email),
    ]);
    boards = b; whiteboardRows = w; spaceRows = s; pendingSpaces = ps; pendingKanban = pk; pendingWhiteboards = pw;
  }

  const getBoardOwnerEmail = (board: (typeof boards)[number]) =>
    "ownerEmail" in board && typeof board.ownerEmail === "string" ? board.ownerEmail : auth.email;

  const resources = await Promise.all(
    [
      ...spaceRows.map((space) => {
  return {
    id: `space-${space.id}`,
    resourceId: space.id,
    type: "space",
    name: space.name,
    role: space.userId === userId ? "owner" : "collaborator",
    members: (space.sharedEmails ?? []).map((email: string) => ({ email, role: "collaborator" })),
pendingInvites: (space.pendingEmails ?? []).map((email: string) => ({ email })),
    owner: { email: space.ownerEmail ?? "", role: "owner" },
  };
}),
      // Flipped implicit any to explicit string here
      ...boards.map((board) => ({
        id: `kanban-${board.id}`,
        resourceId: board.id,
        type: "kanban",
        name: board.name,
        role: board.userId === userId ? "owner" : "collaborator",
        members: (board.sharedEmails ?? []).map((memberEmail: string) => ({ email: memberEmail, role: "collaborator" })),
        pendingInvites: (board.pendingEmails ?? []).map((memberEmail: string) => ({ email: memberEmail })),
        owner: { email: getBoardOwnerEmail(board), role: "owner" },
      })),
      // Flipped implicit any to explicit string here too
      ...whiteboardRows.map((board) => ({
        id: `whiteboard-${board.id}`,
        resourceId: board.id,
        type: "whiteboard",
        name: board.name,
        role: board.userId === userId ? "owner" : "collaborator",
        members: (board.sharedEmails ?? []).map((memberEmail: string) => ({ email: memberEmail, role: "collaborator" })),
        pendingInvites: (board.pendingEmails ?? []).map((memberEmail: string) => ({ email: memberEmail })),
        owner: { email: "owner", role: "owner" },
      })),
    ]
  );

  return {
    resources,
    invitations: [
      ...pendingKanban.map((row) => ({ id: row.board.id, type: "kanban", name: row.board.name, inviter: row.ownerEmail })),
      ...pendingWhiteboards.map((row) => ({
        id: row.board.id,
        type: "whiteboard",
        name: row.board.name,
        inviter: row.ownerName ?? row.ownerEmail,
      })),
      ...pendingSpaces.map((invite) => ({
        id: invite.id,
        type: "space",
        name: invite.spaceName,
        inviter: invite.inviterName,
      })),
    ],
  };
}

export async function getExportData(auth: AuthContext) {
  const userId = auth.dbUser.id;
  const email = normalizeEmail(auth.email);

  const [
    preferences,
    categories,
    calendarItemsData,
    kanbanBoardsData,
    notesData,
    whiteboardsData,
    spacesData,
    templatesData
  ] = await Promise.all([
    getOrCreatePreferences(userId),
    ensureDefaultCategories(userId),
    db.select().from(calendarItems).where(eq(calendarItems.userId, userId)),
    getBoardsWithDetails(userId, email),
    db.select().from(notes).where(eq(notes.userId, userId)),
    getWhiteboardsForUser(userId, email),
    getSpacesForUser(userId, email),
    db.select().from(aiTemplates).where(eq(aiTemplates.userId, userId)),
  ]);

  const spaceIds = spacesData.map((space) => space.id);
  const pagesData = spaceIds.length > 0
    ? await db.select().from(pages).where(inArray(pages.spaceId, spaceIds))
    : [];

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: userId,
      name: auth.dbUser.name ?? auth.clerkUser.fullName ?? auth.email,
      email,
      imageUrl: auth.dbUser.imageUrl ?? auth.clerkUser.imageUrl,
      createdAt: toIso(auth.dbUser.createdAt),
    },
    preferences,
    categories,
    calendarItems: calendarItemsData,
    kanbanBoards: kanbanBoardsData,
    notes: notesData,
    whiteboards: whiteboardsData,
    spaces: spacesData,
    pages: pagesData,
    templates: templatesData,
  };
}

export async function getAccountDeletionPreview(auth: AuthContext) {
  const userId = auth.dbUser.id;
  const email = normalizeEmail(auth.email);
  const [ownedSpaces, sharedSpaceRows, ownedBoards, sharedBoards, ownedWhiteboards, sharedWhiteboardRows] = await Promise.all([
    db.select().from(spaces).where(eq(spaces.userId, userId)),
    db.select().from(spaceMembers).where(eq(spaceMembers.userId, userId)),
    db.select().from(kanbanBoards).where(eq(kanbanBoards.userId, userId)),
    db.select().from(kanbanBoards).where(sql`${kanbanBoards.sharedEmails} @> ${JSON.stringify([email])}::jsonb`),
    db.select().from(whiteboards).where(eq(whiteboards.userId, userId)),
    db.select().from(whiteboards).where(sql`${whiteboards.sharedEmails} @> ${JSON.stringify([email])}::jsonb`),
  ]);

  const spacesBlockingTransfer = ownedSpaces.filter((space) => (space.sharedEmails ?? []).length > 0);
  return {
    canDelete: spacesBlockingTransfer.length === 0,
    blockers: spacesBlockingTransfer.map((space) => ({
      type: "space",
      id: space.id,
      name: space.name,
      reason: "Transfer ownership or remove collaborators before deleting this account.",
    })),
    owned: {
      spaces: ownedSpaces.length,
      kanbanBoards: ownedBoards.length,
      whiteboards: ownedWhiteboards.length,
    },
    sharedMemberships: {
      spaces: sharedSpaceRows.length,
      kanbanBoards: sharedBoards.length,
      whiteboards: sharedWhiteboardRows.length,
    },
  };
}

async function getClerkClient() {
  return typeof clerkClient === "function" ? await clerkClient() : clerkClient;
}

export async function deleteAccount(auth: AuthContext, passwordConfirmation: string) {
  if (!passwordConfirmation.trim()) {
    return { error: "Password confirmation is required" };
  }

  const preview = await getAccountDeletionPreview(auth);
  if (!preview.canDelete) {
    return { error: "Resolve ownership transfer requirements before deleting the account", preview };
  }

  const userId = auth.dbUser.id;
  const email = normalizeEmail(auth.email);

  const [sharedBoards, sharedWhiteboards] = await Promise.all([
    db.select().from(kanbanBoards).where(sql`${kanbanBoards.sharedEmails} @> ${JSON.stringify([email])}::jsonb`),
    db.select().from(whiteboards).where(sql`${whiteboards.sharedEmails} @> ${JSON.stringify([email])}::jsonb`)
  ]);

  const updatePromises = [
    ...sharedBoards.map((board) =>
      db.update(kanbanBoards)
        .set({
          sharedEmails: (board.sharedEmails ?? []).filter((value) => normalizeEmail(value) !== email),
          pendingEmails: (board.pendingEmails ?? []).filter((value) => normalizeEmail(value) !== email),
          updatedAt: new Date(),
        })
        .where(eq(kanbanBoards.id, board.id))
    ),
    ...sharedWhiteboards.map((board) =>
      db.update(whiteboards)
        .set({
          sharedEmails: (board.sharedEmails ?? []).filter((value) => normalizeEmail(value) !== email),
          pendingEmails: (board.pendingEmails ?? []).filter((value) => normalizeEmail(value) !== email),
          updatedAt: new Date(),
        })
        .where(eq(whiteboards.id, board.id))
    )
  ];

  await Promise.all(updatePromises);

  await Promise.all([
    db.delete(spaceMembers).where(eq(spaceMembers.userId, userId)),
    db.update(spaceInvitations)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(or(eq(spaceInvitations.invitedEmail, email), eq(spaceInvitations.invitedBy, userId)))
  ]);

  await db.delete(users).where(eq(users.id, userId));

  const client = await getClerkClient();
  await client.users.deleteUser(auth.clerkUser.id);

  return { success: true };
}