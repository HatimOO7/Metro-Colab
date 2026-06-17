import { NextResponse } from "next/server";
import { getAuthenticatedDbUser } from "@/lib/api-auth";
import { createPageComment, getCommentsForPage, updatePageComment } from "@/lib/page-comments";
import { getPageWithSpaceAccess } from "@/lib/pages";

type Params = { params: Promise<{ id: string; commentId?: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await getAuthenticatedDbUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const pageId = parseInt(id, 10);
  if (isNaN(pageId)) return NextResponse.json({ error: "Invalid page id" }, { status: 400 });

  const row = await getPageWithSpaceAccess(pageId, auth.dbUser.id, auth.email);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comments = await getCommentsForPage(pageId);
  return NextResponse.json({ comments });
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
    const content = typeof body.content === "string" ? body.content : "";
    if (!content.trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 });
    }

    const comment = await createPageComment(pageId, auth.dbUser.id, content);
    if (!comment) {
      return NextResponse.json({ error: "Failed to create comment" }, { status: 400 });
    }

    const createdComment = {
      ...comment,
      authorName: auth.dbUser.name || auth.email,
      authorEmail: auth.email,
      authorImageUrl: auth.dbUser.imageUrl ?? null,
    };

    return NextResponse.json({ comment: createdComment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/pages/[id]/comments error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await getAuthenticatedDbUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, commentId: commentIdParam } = await params;
    const pageId = parseInt(id, 10);
    const commentId = parseInt(commentIdParam || "", 10);
    if (isNaN(pageId) || isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const row = await getPageWithSpaceAccess(pageId, auth.dbUser.id, auth.email);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const content = typeof body.content === "string" ? body.content : "";
    if (!content.trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 });
    }

    const updated = await updatePageComment(commentId, auth.dbUser.id, content);
    if (!updated) {
      return NextResponse.json({ error: "Comment not found or forbidden" }, { status: 403 });
    }

    const updatedComment = {
      ...updated,
      authorName: auth.dbUser.name || auth.email,
      authorEmail: auth.email,
      authorImageUrl: auth.dbUser.imageUrl ?? null,
    };

    return NextResponse.json({ comment: updatedComment });
  } catch (error) {
    console.error("PATCH /api/pages/[id]/comments/[commentId] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}