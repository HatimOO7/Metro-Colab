export const boardColors = ["#d946ef", "#0ea5e9", "#10b981", "#f97316", "#e11d48", "#7c3aed", "#14b8a6"];

export function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
