declare global {
  interface Liveblocks {
    Presence: {
      cursor?: { x: number; y: number } | null;
      name?: string;
      color?: string;
      // Pages & Spaces: identify where the user currently is
      spaceId?: number | null;
      pageId?: number | null;
    };
  }
}

export { };