// Inner Weather — Reddit live source via meme-api.com. Reddit's own JSON 403s datacenter/anon
// IPs (including our serverless proxy), so we go through meme-api.com — a hosted Reddit meme
// proxy that returns image/GIF URLs with no key and CORS (access-control-allow-origin: *).
// SFW only (nsfw + spoiler filtered). GIF subreddits return real .gif URLs that animate right
// in the card <img>. Each card links back to the Reddit thread.

import type { FeedItem } from "../feed";

interface RedditLane {
  sub: string;
  intensity: number;
  kind: FeedItem["kind"];
}

// Subreddit lanes spanning calm → activating. Kept SFW for a stage demo.
export const REDDIT_LANES: RedditLane[] = [
  { sub: "wholesomememes", intensity: 1, kind: "cute" },
  { sub: "aww", intensity: 1, kind: "cute" },
  { sub: "gifs", intensity: 2, kind: "art" },
  { sub: "ProgrammerHumor", intensity: 3, kind: "hottake" },
  { sub: "memes", intensity: 3, kind: "hottake" },
];

interface Meme {
  title?: string;
  url?: string; // the image / .gif
  postLink?: string; // the Reddit thread
  nsfw?: boolean;
  spoiler?: boolean;
}

/** One subreddit (3 memes). Any failure resolves to []; nsfw/spoiler posts are dropped. */
async function fetchLane(lane: RedditLane): Promise<FeedItem[]> {
  try {
    const res = await fetch(`https://meme-api.com/gimme/${lane.sub}/3`);
    if (!res.ok) return [];
    const json = (await res.json()) as { memes?: Meme[] };
    return (json.memes ?? [])
      .filter((m) => m.url && m.title && !m.nsfw && !m.spoiler)
      .map((m) => ({
        id: `reddit-${(m.postLink || m.url || "").split("/").filter(Boolean).pop()}`,
        intensity: lane.intensity,
        kind: lane.kind,
        title: m.title!.trim(),
        source: "reddit",
        url: m.postLink || m.url,
        thumbnail: m.url, // image or .gif — the gif animates in the card
      }));
  } catch {
    return [];
  }
}

/** All lanes, error-isolated. Never rejects; failed lanes contribute nothing. */
export async function fetchReddit(): Promise<FeedItem[]> {
  const settled = await Promise.allSettled(REDDIT_LANES.map(fetchLane));
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
