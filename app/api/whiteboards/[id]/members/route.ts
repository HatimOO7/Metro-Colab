import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, users, whiteboards } from "@/db";
import { getDatabaseUser, getWhiteboardWithAccess } from "@/lib/whiteboard";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const boardId = Number(id);

  if (!Number.isInteger(boardId)) {
    return NextResponse.json({ error: "Invalid board id" }, { status: 400 });
  }

  const board = await getWhiteboardWithAccess(boardId, user.id, user.email);

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const sharedEmails = board.sharedEmails ?? [];
  const pendingEmails = board.pendingEmails ?? [];
  const [ownerResult, collaboratorsResult] = await Promise.all([
    db
      .select({
        email: users.email,
        name: users.name,
        firstName: users.firstName,
        lastName: users.lastName,
        imageUrl: users.imageUrl,
      })
      .from(users)
      .where(eq(users.id, board.userId)),

    sharedEmails.length > 0
      ? db
          .select({
            email: users.email,
            name: users.name,
            firstName: users.firstName,
            lastName: users.lastName,
            imageUrl: users.imageUrl,
          })
          .from(users)
          .where(inArray(users.email, sharedEmails))
      : Promise.resolve([]),
  ]);

  const owner = ownerResult[0];

  const allCollaborators = sharedEmails.map((email) => {
    const record = collaboratorsResult.find((u) => u.email === email);
    return {
      email,
      name:
        record?.name?.trim() ||
        [record?.firstName, record?.lastName].filter(Boolean).join(" ").trim() ||
        email,
      imageUrl: record?.imageUrl ?? null,
      role: "collaborator" as const,
    };
  });

  return NextResponse.json({
    isOwner: board.userId === user.id,
    owner: {
      email: owner?.email ?? "",
      name:
        owner?.name?.trim() ||
        [owner?.firstName, owner?.lastName].filter(Boolean).join(" ").trim() ||
        owner?.email ||
        "Owner",
      imageUrl: owner?.imageUrl ?? null,
      role: "owner" as const,
    },
    collaborators: allCollaborators,
    pendingInvites: pendingEmails,
  });
}