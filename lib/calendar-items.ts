export type ClientCalendarItem = {
  id: number;
  title: string;
  description: string | null;
  itemType: "task" | "reminder";
  category: string;
  categoryColor: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  status: "scheduled" | "draft";
};

export function normalizeCalendarDateKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) {
    return isoPrefix[1];
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function readField(record: Record<string, unknown>, camelKey: string, snakeKey: string) {
  const camelValue = record[camelKey];
  if (camelValue !== undefined && camelValue !== null) {
    return camelValue;
  }

  return record[snakeKey];
}

export function mapApiCalendarItem(item: unknown): ClientCalendarItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const id = Number(record.id);

  if (!Number.isInteger(id)) {
    return null;
  }

  const rawStatus = String(readField(record, "status", "status") ?? "scheduled");
  const status: ClientCalendarItem["status"] = rawStatus === "draft" ? "draft" : "scheduled";
  const rawType = String(readField(record, "itemType", "item_type") ?? "task");

  return {
    id,
    title: String(readField(record, "title", "title") ?? ""),
    description: (readField(record, "description", "description") as string | null) ?? null,
    itemType: rawType === "reminder" ? "reminder" : "task",
    category: String(readField(record, "category", "category") ?? "Work"),
    categoryColor: String(readField(record, "categoryColor", "category_color") ?? "sky"),
    scheduledDate: normalizeCalendarDateKey(readField(record, "scheduledDate", "scheduled_date")),
    scheduledTime: (readField(record, "scheduledTime", "scheduled_time") as string | null) ?? null,
    status,
  };
}

export function mapApiCalendarItems(items: unknown): ClientCalendarItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => mapApiCalendarItem(item))
    .filter((item): item is ClientCalendarItem => Boolean(item));
}

export function isRenderableScheduledItem(item: ClientCalendarItem) {
  return item.status === "scheduled" && Boolean(normalizeCalendarDateKey(item.scheduledDate));
}
