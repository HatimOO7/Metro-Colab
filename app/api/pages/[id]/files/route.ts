import { NextResponse } from "next/server";
import { getAuthenticatedDbUser } from "@/lib/api-auth";
import { createPageFile, getFilesForPage, MAX_FILE_BYTES } from "@/lib/page-files";
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

  const files = await getFilesForPage(pageId);
  return NextResponse.json({ files });
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

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file is required" }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File must be 10 MB or smaller" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const data = buffer.toString("base64");

    const created = await createPageFile(pageId, auth.dbUser.id, {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      data,
    });

    const files = await getFilesForPage(pageId);
    return NextResponse.json({ file: created, files }, { status: 201 });
  } catch (error) {
    console.error("POST /api/pages/[id]/files error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
