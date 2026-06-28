// Inner Weather — Reddit live source adapter.
// Public JSON endpoint, no auth. For each lane we GET /r/{sub}/hot.json?limit=4 and map
// posts → FeedItem using the lane's intensity prior + kind. Every fetch is error-isolated:
// a failing lane contributes nothing and never breaks the demo floor (HERO_FEED).

import type { FeedItem } from "../feed";

export interface RedditLane {
  sub: string;
  intensity: number;
  kind: FeedItem["kind"];
}

// Dev: Vite proxy (/reddit → www.reddit.com) dodges CORS/403 and sets a User-Agent. Prod: a
// same-origin Vercel function (/api/reddit) does the server-side fetch. See api/reddit.ts.
// (Reddit 403s many datacenter IPs, so the prod lane may be empty — handled gracefully.)
const DEV = import.meta.env.DEV;

interface RawRedditPost {
  id: string;
  title: string;
  permalink: string;
  url?: string;
  thumbnail?: string;
  over_18?: boolean;
  stickied?: boolean;
}

interface RedditListing {
  data?: { children?: { kind?: string; data: RawRedditPost }[] };
}

/** Reddit thumbnails are often sentinels ("self"/"default"/"nsfw"/"spoiler"/""). */
function isImageUrl(s?: string): boolean {
  return typeof s === "string" && s.startsWith("http");
}

function toFeedItem(post: RawRedditPost, lane: RedditLane): FeedItem {
  return {
    id: `reddit-${lane.sub}-${post.id}`,
    intensity: lane.intensity,
    kind: lane.kind,
    title: post.title.trim(),
    source: "reddit",
    url: `https://www.reddit.com${post.permalink}`,
    thumbnail: isImageUrl(post.thumbnail) ? post.thumbnail : undefined,
  };
}

/** One subreddit. Any failure (network, non-2xx, bad JSON) resolves to []. */
async function fetchLane(lane: RedditLane): Promise<FeedItem[]> {
  try {
    const url = DEV
      ? `/reddit/r/${lane.sub}/hot.json?limit=4`
      : `/api/reddit?sub=${encodeURIComponent(lane.sub)}&limit=4`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as RedditListing;
    const children = json.data?.children ?? [];
    return children
      .filter((c) => c.kind === "t3")
      .map((c) => c.data)
      .filter((p) => !p.over_18 && !p.stickied && p.title.trim().length > 0)
      .map((p) => toFeedItem(p, lane));
  } catch {
    return [];
  }
}

/** All lanes, error-isolated. Never rejects; failed lanes contribute nothing. */
export async function fetchReddit(lanes: RedditLane[]): Promise<FeedItem[]> {
  const settled = await Promise.allSettled(lanes.map(fetchLane));
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
