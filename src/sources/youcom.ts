// Inner Weather — You.com live source adapter (the $1K prize integration).
// Runs two Search queries — one calm, one trending — and maps the web results to FeedItem
// using a per-query intensity prior + kind. Key in VITE_YOU_API_KEY. Every fetch is
// error-isolated: a missing key, a failed query, or bad JSON contributes nothing and never
// breaks the demo floor (HERO_FEED). The classifier (InsForge AI gateway, a later ticket)
// refines per-item intensity; until then the query prior stands.

import type { FeedItem } from "../feed";

export interface YouComQuery {
  query: string;
  /** source-level intensity prior (1 soothing … 5 agitating) */
  intensity: number;
  kind: FeedItem["kind"];
}

/**
 * The two lanes. Calm clears every ceiling (always visible); trending is intensity 5 — it's
 * shielded in Fog/Perseverance and only surfaces in Sharp, so it exercises the flip.
 */
export const YOUCOM_QUERIES: YouComQuery[] = [
  { query: "wholesome calming nature", intensity: 2, kind: "nature" },
  { query: "biggest tech hot takes today", intensity: 5, kind: "hottake" },
];

// Dev: Vite proxy (/youcom → ydc-index.io) dodges CORS, client sends the key. Prod: a
// same-origin Vercel function (/api/youcom) injects the key server-side so it never ships
// in the bundle. See api/youcom.ts and vite.config.ts.
const DEV = import.meta.env.DEV;

interface RawYouComResult {
  url: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  snippets?: string[];
}

interface YouComResponse {
  results?: { web?: RawYouComResult[] };
}

/** You.com sometimes returns a generic site-icon URL; anything non-http is dropped. */
function isImageUrl(s?: string): boolean {
  return typeof s === "string" && s.startsWith("http");
}

/** Query text → stable id fragment, e.g. "biggest tech hot takes today" → "biggest-tech-...". */
function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toFeedItem(r: RawYouComResult, q: YouComQuery, i: number): FeedItem {
  return {
    id: `you-${slug(q.query)}-${i}`,
    intensity: q.intensity,
    kind: q.kind,
    title: r.title.trim(),
    body: r.description?.trim() || r.snippets?.[0],
    source: "you.com",
    url: r.url,
    thumbnail: isImageUrl(r.thumbnail_url) ? r.thumbnail_url : undefined,
  };
}

/** One query. Any failure (network, non-2xx, bad JSON) resolves to []. */
async function fetchQuery(q: YouComQuery, key: string): Promise<FeedItem[]> {
  try {
    const url = DEV
      ? `/youcom/v1/search?query=${encodeURIComponent(q.query)}&count=5`
      : `/api/youcom?query=${encodeURIComponent(q.query)}&count=5`;
    const res = await fetch(url, DEV ? { headers: { "X-API-Key": key } } : undefined);
    if (!res.ok) {
      console.warn(`You.com: query "${q.query}" failed (${res.status})`);
      return [];
    }
    const json = (await res.json()) as YouComResponse;
    const web = json.results?.web ?? [];
    return web
      .filter((r) => r.url && r.title?.trim().length > 0)
      .map((r, i) => toFeedItem(r, q, i));
  } catch (err) {
    console.warn(`You.com: query "${q.query}" fetch failed`, err);
    return [];
  }
}

/** Both queries, error-isolated. Never rejects; missing key → []. */
export async function fetchYouCom(): Promise<FeedItem[]> {
  // Dev needs the client key (sent through the Vite proxy); in prod the key lives only in the
  // serverless function, so an empty client key is expected there — only skip in dev.
  const key = (import.meta.env.VITE_YOU_API_KEY as string | undefined) ?? "";
  if (DEV && !key) {
    console.info("You.com: VITE_YOU_API_KEY not set — skipping the live web lane.");
    return [];
  }
  try {
    const settled = await Promise.allSettled(YOUCOM_QUERIES.map((q) => fetchQuery(q, key)));
    return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  } catch {
    return []; // belt-and-suspenders: fetchQuery is already total
  }
}
