// Inner Weather — Hacker News live source. Algolia HN Search API: no key, and it sends CORS
// headers, so the browser can call it directly in dev AND prod (no serverless proxy needed).
// Front-page stories → FeedItem at a neutral-ish intensity 3; the classifier refines later.
// HN has no native images, so thumbnails are added centrally in feed.ts (page screenshot).

import type { FeedItem } from "../feed";

interface HNHit {
  objectID: string;
  title?: string;
  url?: string;
}

/** Front-page HN. Any failure (network, non-2xx, bad JSON) resolves to []. */
export async function fetchHackerNews(): Promise<FeedItem[]> {
  try {
    const res = await fetch(
      "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=8"
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { hits?: HNHit[] };
    return (json.hits ?? [])
      .filter((h) => h.title && h.title.trim().length > 0)
      .map((h) => ({
        id: `hn-${h.objectID}`,
        intensity: 3,
        kind: "news" as const,
        title: h.title!.trim(),
        source: "hacker news",
        // Ask/Show HN posts have no external url — link to the HN discussion instead.
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      }));
  } catch {
    return [];
  }
}
