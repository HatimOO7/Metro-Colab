import { NextResponse } from "next/server";
import { getAuthenticatedDbUser } from "@/lib/api-auth";
import { createPageComment, getCommentsForPage } from "@/lib/page-comments";
import { getPageWithSpaceAccess } from "@/lib/pages";

type Params = { params: Promise<{ id: string }> };

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

    const comments = await getCommentsForPage(pageId);
    const created = comments.find((c) => c.id === comment.id);
    return NextResponse.json({ comment: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/pages/[id]/comments error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
