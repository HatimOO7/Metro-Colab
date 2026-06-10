import { NextResponse } from "next/server";
import { getAuthenticatedDbUser } from "@/lib/api-auth";
import { deletePageFile, getPageFileById } from "@/lib/page-files";
import { getPageWithSpaceAccess } from "@/lib/pages";

type Params = { params: Promise<{ id: string; fileId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await getAuthenticatedDbUser();
  if (!auth) return new NextResponse("Unauthorized", { status: 401 });

  const { id, fileId: fileIdParam } = await params;
  const pageId = parseInt(id, 10);
  const fileId = parseInt(fileIdParam, 10);
  if (isNaN(pageId) || isNaN(fileId)) {
    return new NextResponse("Invalid id", { status: 400 });
  }

  const row = await getPageWithSpaceAccess(pageId, auth.dbUser.id, auth.email);
  if (!row) return new NextResponse("Not found", { status: 404 });

  const file = await getPageFileById(pageId, fileId);
  if (!file) return new NextResponse("Not found", { status: 404 });

  const buffer = Buffer.from(file.data, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`,
      "Content-Length": String(buffer.length),
    },
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await getAuthenticatedDbUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, fileId: fileIdParam } = await params;
    const pageId = parseInt(id, 10);
    const fileId = parseInt(fileIdParam, 10);
    if (isNaN(pageId) || isNaN(fileId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const row = await getPageWithSpaceAccess(pageId, auth.dbUser.id, auth.email);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const deleted = await deletePageFile(pageId, fileId);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/pages/[id]/files/[fileId] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
