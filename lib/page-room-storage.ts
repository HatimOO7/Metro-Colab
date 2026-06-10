import { LiveList, LiveObject } from "@liveblocks/client";

export type PageTaskData = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
};

export function pageInitialStorage() {
  return {
    tasks: new LiveList<LiveObject<PageTaskData>>([]),
  };
}
