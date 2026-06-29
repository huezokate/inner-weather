// Inner Weather — Dev.to live source. Public API, no key, sends CORS (access-control-allow-origin: *),
// so the browser calls it directly in dev and prod. Top tech articles of the week → FeedItem,
// using each article's cover image. Neutral intensity 3; the classifier refines later.

import type { FeedItem } from "../feed";

interface DevToArticle {
  id: number;
  title: string;
  url: string;
  cover_image?: string | null;
  social_image?: string | null;
}

/** Top dev.to articles. Any failure (network, non-2xx, bad JSON) resolves to []. */
export async function fetchDevTo(): Promise<FeedItem[]> {
  try {
    const res = await fetch("https://dev.to/api/articles?per_page=8&top=7");
    if (!res.ok) return [];
    const arts = (await res.json()) as DevToArticle[];
    return arts
      .filter((a) => a.title && a.url)
      .map((a) => ({
        id: `devto-${a.id}`,
        intensity: 3,
        kind: "news" as const,
        title: a.title.trim(),
        source: "dev.to",
        url: a.url,
        thumbnail: a.cover_image || a.social_image || undefined,
      }));
  } catch {
    return [];
  }
}
