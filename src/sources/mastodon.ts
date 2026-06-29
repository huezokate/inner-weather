// Inner Weather — Mastodon live source. Public hashtag timelines on mastodon.social: no auth,
// sends CORS, image-rich. Topical tags act as intensity lanes (like the old Reddit lanes, but
// these actually work in prod). only_media=true + skipping `sensitive` posts keeps it stage-safe.

import type { FeedItem } from "../feed";

interface MastoLane {
  tag: string;
  intensity: number;
  kind: FeedItem["kind"];
}

// Safe, reliably-populated tags spanning calm → spicy. Each lane sets a source-prior intensity.
export const MASTO_LANES: MastoLane[] = [
  { tag: "nature", intensity: 1, kind: "nature" },
  { tag: "cats", intensity: 1, kind: "cute" },
  { tag: "art", intensity: 2, kind: "art" },
  { tag: "photography", intensity: 2, kind: "art" },
  { tag: "science", intensity: 3, kind: "news" },
  { tag: "technology", intensity: 3, kind: "news" },
  { tag: "ai", intensity: 4, kind: "hottake" },
];

interface MastoMedia {
  preview_url?: string;
  type?: string;
}
interface MastoStatus {
  id: string;
  url?: string;
  content?: string;
  sensitive?: boolean;
  media_attachments?: MastoMedia[];
}

/** Strip HTML tags + decode the handful of entities Mastodon emits; collapse whitespace. */
function plain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** One tag timeline. Any failure resolves to []; sensitive/imageless posts are dropped. */
async function fetchTag(lane: MastoLane): Promise<FeedItem[]> {
  try {
    const res = await fetch(
      `https://mastodon.social/api/v1/timelines/tag/${lane.tag}?limit=3&only_media=true`
    );
    if (!res.ok) return [];
    const statuses = (await res.json()) as MastoStatus[];
    return statuses
      .filter((s) => !s.sensitive && s.url && s.media_attachments?.[0]?.preview_url)
      .map((s) => {
        const text = plain(s.content || "");
        return {
          id: `masto-${s.id}`,
          intensity: lane.intensity,
          kind: lane.kind,
          title: (text || `#${lane.tag}`).slice(0, 140),
          source: "mastodon",
          url: s.url as string,
          thumbnail: s.media_attachments![0].preview_url,
        };
      });
  } catch {
    return [];
  }
}

/** All lanes, error-isolated. Never rejects; failed lanes contribute nothing. */
export async function fetchMastodon(): Promise<FeedItem[]> {
  const settled = await Promise.allSettled(MASTO_LANES.map(fetchTag));
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
