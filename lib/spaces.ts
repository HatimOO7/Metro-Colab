import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db, pages, spaceInvitations, spaceMembers, spaces, users } from "@/db";
import { copyPageTaskLinks } from "@/lib/page-tasks";
import { ensureOwnerMembership, getSpaceRole, isSpaceOwner } from "@/lib/space-permissions";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";

export async function getDatabaseUser() {
  return syncCurrentUserToDatabase();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function getSpacesForUser(userId: number, email: string) {
  const normalizedEmail = normalizeEmail(email);

  const memberRows = await db
    .select({ spaceId: spaceMembers.spaceId })
    .from(spaceMembers)
    .where(eq(spaceMembers.userId, userId));
  const memberSpaceIds = memberRows.map((row) => row.spaceId);

  const accessFilters = [
    eq(spaces.userId, userId),
    sql`${spaces.sharedEmails} @> ${JSON.stringify([normalizedEmail])}::jsonb`,
  ];
  if (memberSpaceIds.length > 0) {
    accessFilters.push(inArray(spaces.id, memberSpaceIds));
  }

  const rows = await db
    .select({ space: spaces, ownerEmail: users.email })
    .from(spaces)
    .innerJoin(users, eq(spaces.userId, users.id))
    .where(or(...accessFilters))
    .orderBy(desc(spaces.updatedAt));

  const seen = new Set<number>();
  return rows
    .filter(({ space }) => {
      if (seen.has(space.id)) return false;
      seen.add(space.id);
      return true;
    })
    .map(({ space, ownerEmail }) => ({
      ...space,
      ownerEmail: ownerEmail ?? undefined,
    }));
}

export async function getSpaceWithAccess(
  spaceId: number,
  userId: number,
  email: string
) {
  const [row] = await db
    .select({ space: spaces, ownerEmail: users.email })
    .from(spaces)
    .innerJoin(users, eq(spaces.userId, users.id))
    .where(eq(spaces.id, spaceId));

  if (!row) return null;

  let role = await getSpaceRole(spaceId, userId);
  if (!role) {
    const normalizedEmail = normalizeEmail(email);
    const sharedEmails = (row.space.sharedEmails ?? []).map(normalizeEmail);
    if (!sharedEmails.includes(normalizedEmail)) return null;
    role = "collaborator";
  }

  return { ...row.space, ownerEmail: row.ownerEmail ?? undefined, role };
}

export async function getSpaceOwner(spaceId: number) {
  const [row] = await db
    .select({ userId: spaces.userId })
    .from(spaces)
    .where(eq(spaces.id, spaceId));
  return row?.userId ?? null;
}

export async function createSpace(
  userId: number,
  data: {
    name: string;
    description?: string | null;
    color?: string;
  }
) {
  const [space] = await db
    .insert(spaces)
    .values({
      userId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      color: data.color ?? "indigo",
    })
    .returning();

  if (!space) throw new Error("Failed to create space");

  await ensureOwnerMembership(space.id, userId);
  return space;
}

export async function updateSpace(
  spaceId: number,
  userId: number,
  data: Partial<{
    name: string;
    description: string | null;
    color: string;
    isFavorite: boolean;
    isArchived: boolean;
    sharedEmails: string[];
    pendingEmails: string[];
  }>
) {
  const owner = await isSpaceOwner(spaceId, userId);
  if (!owner) return null;

  const patch: Record<string, unknown> = { ...data, updatedAt: new Date() };

  if (typeof data.isArchived === "boolean") {
    patch.archivedAt = data.isArchived ? new Date() : null;
  }

  const [space] = await db
    .update(spaces)
    .set(patch)
    .where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId)))
    .returning();

  return space ?? null;
}

export async function deleteSpace(spaceId: number, userId: number) {
  const owner = await isSpaceOwner(spaceId, userId);
  if (!owner) return false;

  await db.delete(spaces).where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId)));
  return true;
}

export async function duplicateSpace(spaceId: number, userId: number) {
  const owner = await isSpaceOwner(spaceId, userId);
  if (!owner) return null;

  const [original] = await db.select().from(spaces).where(eq(spaces.id, spaceId));
  if (!original) return null;

  const [copy] = await db
    .insert(spaces)
    .values({
      userId,
      name: `Copy of ${original.name}`,
      description: original.description,
      color: original.color,
      isFavorite: false,
      isArchived: false,
      archivedAt: null,
      sharedEmails: [],
      pendingEmails: [],
    })
    .returning();

  if (!copy) return null;

  await ensureOwnerMembership(copy.id, userId);

  const sourcePages = await db
    .select()
    .from(pages)
    .where(and(eq(pages.spaceId, spaceId), eq(pages.isArchived, false)));

  for (const sourcePage of sourcePages) {
    const [pageCopy] = await db
      .insert(pages)
      .values({
        spaceId: copy.id,
        userId,
        lastEditedByUserId: userId,
        title: sourcePage.title,
        template: sourcePage.template,
        description: sourcePage.description,
        isFavorite: false,
        isArchived: false,
        archivedAt: null,
        commentsCount: 0,
        linkedTasksCount: 0,
      })
      .returning();

    if (pageCopy) {
      await copyPageTaskLinks(sourcePage.id, pageCopy.id);
    }
  }

  return copy;
}

export async function getSpacePageCount(spaceId: number) {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pages)
    .where(and(eq(pages.spaceId, spaceId), eq(pages.isArchived, false)));
  return result[0]?.count ?? 0;
}

export async function inviteSpaceCollaborator(
  spaceId: number,
  ownerId: number,
  invitedEmail: string
) {
  const owner = await isSpaceOwner(spaceId, ownerId);
  if (!owner) return { error: "Only the space owner can invite collaborators" };

  const email = normalizeEmail(invitedEmail);
  const [ownerUser] = await db.select().from(users).where(eq(users.id, ownerId));
  if (ownerUser && normalizeEmail(ownerUser.email) === email) {
    return { error: "You cannot invite yourself" };
  }

  const targetUser = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!targetUser) {
    return { error: "No registered user found with that email" };
  }

  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId));
  if (!space) return { error: "Space not found" };

  const sharedEmails = (space.sharedEmails ?? []).map(normalizeEmail);
  if (sharedEmails.includes(email)) {
    return { error: "User is already a collaborator" };
  }

  const [existingMember] = await db
    .select()
    .from(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, targetUser.id)));

  if (existingMember) {
    return { error: "User is already a member" };
  }

  const [existingInvite] = await db
    .select()
    .from(spaceInvitations)
    .where(
      and(
        eq(spaceInvitations.spaceId, spaceId),
        eq(spaceInvitations.invitedEmail, email),
        eq(spaceInvitations.status, "pending")
      )
    );

  if (existingInvite) {
    return { invitation: existingInvite };
  }

  const [invitation] = await db
    .insert(spaceInvitations)
    .values({
      spaceId,
      invitedBy: ownerId,
      invitedEmail: email,
      invitedUserId: targetUser.id,
      status: "pending",
    })
    .returning();

  const pendingEmails = [...(space.pendingEmails ?? []).map(normalizeEmail), email].filter(
    (value, index, array) => array.indexOf(value) === index
  );

  await db
    .update(spaces)
    .set({ pendingEmails, updatedAt: new Date() })
    .where(eq(spaces.id, spaceId));

  return { invitation };
}

export async function revokeSpaceInvitation(invitationId: number, ownerId: number) {
  const [invitation] = await db
    .select()
    .from(spaceInvitations)
    .where(eq(spaceInvitations.id, invitationId));

  if (!invitation) return { error: "Invitation not found" };

  const owner = await isSpaceOwner(invitation.spaceId, ownerId);
  if (!owner) return { error: "Only the space owner can revoke invitations" };

  if (invitation.status !== "pending") {
    return { error: "Invitation is not pending" };
  }

  await db
    .update(spaceInvitations)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(spaceInvitations.id, invitationId));

  const [space] = await db.select().from(spaces).where(eq(spaces.id, invitation.spaceId));
  if (space) {
    const pendingEmails = (space.pendingEmails ?? []).filter(
      (e) => normalizeEmail(e) !== normalizeEmail(invitation.invitedEmail)
    );
    await db
      .update(spaces)
      .set({ pendingEmails, updatedAt: new Date() })
      .where(eq(spaces.id, invitation.spaceId));
  }

  return { success: true };
}

export async function acceptSpaceInvitation(invitationId: number, userId: number, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const [invitation] = await db
    .select()
    .from(spaceInvitations)
    .where(
      and(
        eq(spaceInvitations.id, invitationId),
        eq(spaceInvitations.invitedEmail, normalizedEmail),
        eq(spaceInvitations.status, "pending")
      )
    );

  if (!invitation) return { error: "No pending invitation found" };

  const [space] = await db.select().from(spaces).where(eq(spaces.id, invitation.spaceId));
  if (!space) return { error: "Space not found" };

  await db.insert(spaceMembers).values({
    spaceId: invitation.spaceId,
    userId,
    role: "collaborator",
  });

  const sharedEmails = [...(space.sharedEmails ?? []).map(normalizeEmail), normalizedEmail].filter(
    (value, index, array) => array.indexOf(value) === index
  );
  const pendingEmails = (space.pendingEmails ?? [])
    .map(normalizeEmail)
    .filter((e) => e !== normalizedEmail);

  await db
    .update(spaces)
    .set({ sharedEmails, pendingEmails, updatedAt: new Date() })
    .where(eq(spaces.id, invitation.spaceId));

  await db
    .update(spaceInvitations)
    .set({ status: "accepted", invitedUserId: userId, updatedAt: new Date() })
    .where(eq(spaceInvitations.id, invitationId));

  return { success: true, spaceId: invitation.spaceId };
}

export async function declineSpaceInvitation(invitationId: number, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const [invitation] = await db
    .select()
    .from(spaceInvitations)
    .where(
      and(
        eq(spaceInvitations.id, invitationId),
        eq(spaceInvitations.invitedEmail, normalizedEmail),
        eq(spaceInvitations.status, "pending")
      )
    );

  if (!invitation) return { error: "No pending invitation found" };

  await db
    .update(spaceInvitations)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(spaceInvitations.id, invitationId));

  const [space] = await db.select().from(spaces).where(eq(spaces.id, invitation.spaceId));
  if (space) {
    const pendingEmails = (space.pendingEmails ?? []).filter(
      (e) => normalizeEmail(e) !== normalizedEmail
    );
    await db
      .update(spaces)
      .set({ pendingEmails, updatedAt: new Date() })
      .where(eq(spaces.id, invitation.spaceId));
  }

  return { success: true };
}

export async function removeSpaceCollaborator(spaceId: number, ownerId: number, email: string) {
  const owner = await isSpaceOwner(spaceId, ownerId);
  if (!owner) return { error: "Only the space owner can remove collaborators" };

  const normalizedEmail = normalizeEmail(email);
  const targetUser = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });
  if (!targetUser) return { error: "User not found" };

  const spaceOwnerId = await getSpaceOwner(spaceId);
  if (spaceOwnerId === targetUser.id) {
    return { error: "Cannot remove the space owner" };
  }

  await db
    .delete(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, targetUser.id)));

  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId));
  if (space) {
    const sharedEmails = (space.sharedEmails ?? []).filter(
      (e) => normalizeEmail(e) !== normalizedEmail
    );
    const pendingEmails = (space.pendingEmails ?? []).filter(
      (e) => normalizeEmail(e) !== normalizedEmail
    );
    await db
      .update(spaces)
      .set({ sharedEmails, pendingEmails, updatedAt: new Date() })
      .where(eq(spaces.id, spaceId));
  }

  return { success: true };
}

export async function getPendingInvitationsForUser(email: string) {
  const normalizedEmail = normalizeEmail(email);

  const rows = await db
    .select({
      invitation: spaceInvitations,
      space: spaces,
      inviterName: users.name,
      inviterFirstName: users.firstName,
      inviterLastName: users.lastName,
      inviterEmail: users.email,
    })
    .from(spaceInvitations)
    .innerJoin(spaces, eq(spaceInvitations.spaceId, spaces.id))
    .innerJoin(users, eq(spaceInvitations.invitedBy, users.id))
    .where(
      and(
        eq(spaceInvitations.invitedEmail, normalizedEmail),
        eq(spaceInvitations.status, "pending")
      )
    )
    .orderBy(desc(spaceInvitations.createdAt));

  return rows.map((row) => ({
    ...row.invitation,
    spaceName: row.space.name,
    spaceColor: row.space.color,
    inviterName:
      row.inviterName?.trim() ||
      [row.inviterFirstName, row.inviterLastName].filter(Boolean).join(" ").trim() ||
      row.inviterEmail,
  }));
}

export async function getSpaceMembers(spaceId: number) {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId));
  if (!space) return null;

  const [owner] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      imageUrl: users.imageUrl,
    })
    .from(users)
    .where(eq(users.id, space.userId));

  const collaborators = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      imageUrl: users.imageUrl,
      role: spaceMembers.role,
    })
    .from(spaceMembers)
    .innerJoin(users, eq(spaceMembers.userId, users.id))
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.role, "collaborator")));

  const pendingInvites = await db
    .select({
      id: spaceInvitations.id,
      invitedEmail: spaceInvitations.invitedEmail,
      createdAt: spaceInvitations.createdAt,
      invitedUserId: spaceInvitations.invitedUserId,
    })
    .from(spaceInvitations)
    .where(and(eq(spaceInvitations.spaceId, spaceId), eq(spaceInvitations.status, "pending")));

  const pendingWithUsers = await Promise.all(
    pendingInvites.map(async (invite) => {
      const [user] = invite.invitedUserId
        ? await db
            .select({
              name: users.name,
              firstName: users.firstName,
              lastName: users.lastName,
              imageUrl: users.imageUrl,
            })
            .from(users)
            .where(eq(users.id, invite.invitedUserId))
        : await db
            .select({
              name: users.name,
              firstName: users.firstName,
              lastName: users.lastName,
              imageUrl: users.imageUrl,
            })
            .from(users)
            .where(eq(users.email, invite.invitedEmail));

      return {
        id: invite.id,
        email: invite.invitedEmail,
        name:
          user?.name?.trim() ||
          [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
          invite.invitedEmail,
        imageUrl: user?.imageUrl ?? null,
      };
    })
  );

  return {
    owner: {
      id: owner?.id ?? space.userId,
      email: owner?.email ?? "",
      name:
        owner?.name?.trim() ||
        [owner?.firstName, owner?.lastName].filter(Boolean).join(" ").trim() ||
        owner?.email ||
        "Owner",
      imageUrl: owner?.imageUrl ?? null,
      role: "owner" as const,
    },
    collaborators: collaborators.map((c) => ({
      id: c.id,
      email: c.email,
      name:
        c.name?.trim() ||
        [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ||
        c.email,
      imageUrl: c.imageUrl,
      role: "collaborator" as const,
    })),
    pendingInvites: pendingWithUsers,
    memberCount: 1 + collaborators.length,
  };
}
