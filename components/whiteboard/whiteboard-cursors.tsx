"use client";

import { useOthers } from "@liveblocks/react/suspense";

const CURSOR_COLORS = ["#0ea5e9", "#10b981", "#f97316", "#e11d48", "#7c3aed", "#14b8a6"];

export function WhiteboardCursors() {
  const others = useOthers();

  return (
    <>
      {others.map(({ connectionId, presence, info }) => {
        const cursor = presence?.cursor;
        if (!cursor) {
          return null;
        }

        const color = presence?.color ?? CURSOR_COLORS[connectionId % CURSOR_COLORS.length];
        const name = info?.name ?? presence?.name ?? "Guest";

        return (
          <div
            key={connectionId}
            className="pointer-events-none absolute left-0 top-0 z-[60]"
            style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true">
              <path
                d="M0 0L0 16L4.5 12.5L7.5 19L10 17.5L7 11L12 11L0 0Z"
                fill={color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            <span
              className="ml-3 -mt-1 inline-block max-w-[140px] truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              {name}
            </span>
          </div>
        );
      })}
    </>
  );
}
