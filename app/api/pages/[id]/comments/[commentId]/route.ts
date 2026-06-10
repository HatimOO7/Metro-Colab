import { NextResponse } from "next/server";
import { getAuthenticatedDbUser } from "@/lib/api-auth";
import { deletePageComment, getCommentsForPage, updatePageComment } from "@/lib/page-comments";
import { getPageWithSpaceAccess } from "@/lib/pages";

type Params = { params: Promise<{ id: string; commentId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await getAuthenticatedDbUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, commentId: commentIdParam } = await params;
    const pageId = parseInt(id, 10);
    const commentId = parseInt(commentIdParam, 10);
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

    const comments = await getCommentsForPage(pageId);
    const comment = comments.find((c) => c.id === commentId);
    return NextResponse.json({ comment });
  } catch (error) {
    console.error("PATCH /api/pages/[id]/comments/[commentId] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await getAuthenticatedDbUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, commentId: commentIdParam } = await params;
    const pageId = parseInt(id, 10);
    const commentId = parseInt(commentIdParam, 10);
    if (isNaN(pageId) || isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const row = await getPageWithSpaceAccess(pageId, auth.dbUser.id, auth.email);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const deleted = await deletePageComment(commentId, auth.dbUser.id);
    if (!deleted) {
      return NextResponse.json({ error: "Comment not found or forbidden" }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/pages/[id]/comments/[commentId] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
