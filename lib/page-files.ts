import { desc, eq } from "drizzle-orm";
import { db, pageFiles, users } from "@/db";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export { MAX_FILE_BYTES };

export async function getFilesForPage(pageId: number) {
  const rows = await db
    .select({
      id: pageFiles.id,
      fileName: pageFiles.fileName,
      mimeType: pageFiles.mimeType,
      sizeBytes: pageFiles.sizeBytes,
      createdAt: pageFiles.createdAt,
      uploaderName: users.name,
      uploaderEmail: users.email,
    })
    .from(pageFiles)
    .innerJoin(users, eq(pageFiles.userId, users.id))
    .where(eq(pageFiles.pageId, pageId))
    .orderBy(desc(pageFiles.createdAt));

  return rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.createdAt.toISOString(),
    uploaderName: row.uploaderName ?? row.uploaderEmail ?? "Member",
  }));
}

export async function getPageFileById(pageId: number, fileId: number) {
  const [file] = await db
    .select()
    .from(pageFiles)
    .where(eq(pageFiles.id, fileId));

  if (!file || file.pageId !== pageId) return null;
  return file;
}

export async function createPageFile(
  pageId: number,
  userId: number,
  file: { fileName: string; mimeType: string; sizeBytes: number; data: string }
) {
  const [row] = await db
    .insert(pageFiles)
    .values({
      pageId,
      userId,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      data: file.data,
    })
    .returning();

  return row;
}

export async function deletePageFile(pageId: number, fileId: number) {
  const [deleted] = await db
    .delete(pageFiles)
    .where(eq(pageFiles.id, fileId))
    .returning();

  if (!deleted || deleted.pageId !== pageId) return false;
  return true;
}
