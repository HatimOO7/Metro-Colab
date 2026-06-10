import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, kanbanBoards, kanbanTasks } from "@/db";
import { getAuthenticatedDbUser } from "@/lib/api-auth";
import { attachTaskToPage, detachTaskFromPage, getLinkedTasksForPage } from "@/lib/page-tasks";
import { getPageWithSpaceAccess } from "@/lib/pages";

type Params = { params: Promise<{ id: string }> };

async function userCanAccessTask(userId: number, email: string, taskId: number) {
  const [task] = await db.select().from(kanbanTasks).where(eq(kanbanTasks.id, taskId));
  if (!task) return false;

  const [board] = await db.select().from(kanbanBoards).where(eq(kanbanBoards.id, task.boardId));
  if (!board) return false;

  if (board.userId === userId) return true;
  return (board.sharedEmails ?? []).map((e) => e.toLowerCase()).includes(email.toLowerCase());
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await getAuthenticatedDbUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const pageId = parseInt(id, 10);
  if (isNaN(pageId)) return NextResponse.json({ error: "Invalid page id" }, { status: 400 });

  const row = await getPageWithSpaceAccess(pageId, auth.dbUser.id, auth.email);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tasks = await getLinkedTasksForPage(pageId);
  return NextResponse.json({ tasks });
}

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await getAuthenticatedDbUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const pageId = parseInt(id, 10);
    if (isNaN(pageId)) return NextResponse.json({ error: "Invalid page id" }, { status: 400 });

    const row = await getPageWithSpaceAccess(pageId, auth.dbUser.id, auth.email);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const taskId = parseInt(String(body.taskId), 10);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "Valid taskId is required" }, { status: 400 });
    }

    const canAccess = await userCanAccessTask(auth.dbUser.id, auth.email, taskId);
    if (!canAccess) {
      return NextResponse.json({ error: "Task not found or forbidden" }, { status: 403 });
    }

    const link = await attachTaskToPage(pageId, taskId);
    if (!link) return NextResponse.json({ error: "Failed to attach task" }, { status: 400 });

    const tasks = await getLinkedTasksForPage(pageId);
    return NextResponse.json({ tasks }, { status: 201 });
  } catch (error) {
    console.error("POST /api/pages/[id]/tasks error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const auth = await getAuthenticatedDbUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const pageId = parseInt(id, 10);
    if (isNaN(pageId)) return NextResponse.json({ error: "Invalid page id" }, { status: 400 });

    const row = await getPageWithSpaceAccess(pageId, auth.dbUser.id, auth.email);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const taskId = parseInt(String((body as { taskId?: number }).taskId), 10);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "Valid taskId is required" }, { status: 400 });
    }

    await detachTaskFromPage(pageId, taskId);
    const tasks = await getLinkedTasksForPage(pageId);
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("DELETE /api/pages/[id]/tasks error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
