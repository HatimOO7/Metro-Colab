import { and, eq } from "drizzle-orm";
import { db, spaceMembers, spaces } from "@/db";

export type SpaceRole = "owner" | "collaborator";

export async function getSpaceRole(
  spaceId: number,
  userId: number
): Promise<SpaceRole | null> {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId));
  if (!space) return null;

  if (space.userId === userId) return "owner";

  const [member] = await db
    .select()
    .from(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId)));

  if (!member) return null;
  return member.role === "owner" ? "owner" : "collaborator";
}

export async function isSpaceOwner(spaceId: number, userId: number) {
  return (await getSpaceRole(spaceId, userId)) === "owner";
}

export async function hasSpaceAccess(spaceId: number, userId: number) {
  return (await getSpaceRole(spaceId, userId)) !== null;
}

export async function ensureOwnerMembership(spaceId: number, userId: number) {
  const existing = await db
    .select()
    .from(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId)));

  if (existing.length === 0) {
    await db.insert(spaceMembers).values({
      spaceId,
      userId,
      role: "owner",
    });
  }
}
