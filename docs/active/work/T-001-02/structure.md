# T-001-02 · Structure — reddit-live-feed

The shape of the code. File-level changes, interfaces, ordering. Not the code itself.

## Files: created / modified / deleted

| File | Action | Why |
| --- | --- | --- |
| `src/sources/reddit.ts` | **create** | Reddit adapter (transport + mapping). |
| `src/feed.ts` | **modify** | Add `thumbnail?`; implement `fetchLiveFeed()` (dedup+cap). |
| `vite.config.ts` | **modify** | Add `/reddit` dev proxy (CORS/User-Agent). |
| `src/App.tsx` | **untouched** | Render stays emoji-first (D2). No change needed. |
| (none) | delete | Nothing removed. |

## `src/sources/reddit.ts` (new)

Public surface:

```ts
import type { FeedItem } from "../feed";

export interface RedditLane {
  sub: string;
  intensity: number;
  kind: FeedItem["kind"];
}

/** All lanes, error-isolated. Never rejects; failed lanes contribute nothing. */
export function fetchReddit(lanes: RedditLane[]): Promise<FeedItem[]>;
```

Internal (not exported):

- `REDDIT_BASE` — `import.meta.env.DEV ? "/reddit" : "https://www.reddit.com"` (D1).
- `RawRedditPost` — minimal typed interface for the fields used:
  `{ id, title, permalink, url?, thumbnail?, over_18?, stickied? }`.
- `RedditListing` — `{ data: { children: { kind: string; data: RawRedditPost }[] } }`.
- `fetchLane(lane): Promise<FeedItem[]>` — one subreddit:
  1. `fetch(`${REDDIT_BASE}/r/${lane.sub}/hot.json?limit=4`)` inside try/catch.
  2. Non-2xx → throw (caught → `[]`).
  3. Parse JSON as `RedditListing`.
  4. `children` → filter `kind === "t3"`, drop `over_18`, `stickied`, empty title.
  5. Map each to `FeedItem` via `toFeedItem(post, lane)`.
  6. catch → return `[]`.
- `toFeedItem(post, lane): FeedItem`:
  - `id`: `reddit-${lane.sub}-${post.id}` (D6).
  - `intensity`: `lane.intensity` (D8).
  - `kind`: `lane.kind`.
  - `title`: `post.title.trim()`.
  - `source`: `"reddit"`.
  - `url`: `https://www.reddit.com${post.permalink}` (link to discussion).
  - `thumbnail`: `isImageUrl(post.thumbnail) ? post.thumbnail : undefined` (D2/D7).
  - `emoji`: omitted → App falls back to `🗞️`.
- `isImageUrl(s?): boolean` — true only when `s` starts with `http` (drops `self`,
  `default`, `nsfw`, `spoiler`, `""`).
- `fetchReddit(lanes)`: `Promise.allSettled(lanes.map(fetchLane))`, flatten fulfilled
  values, return. Rejected settlements can't happen (fetchLane swallows), but allSettled is
  the belt to the per-lane suspenders (D4).

Module boundary: `reddit.ts` knows transport + Reddit JSON; it imports only the `FeedItem`
*type* from `feed.ts` (type-only import → no runtime cycle).

## `src/feed.ts` (modify)

1. **`FeedItem`** — add one optional field after `url?`:
   ```ts
   thumbnail?: string; // real image URL from a live source (Reddit), when present
   ```
2. **`fetchLiveFeed()`** — replace the placeholder body:
   ```ts
   export async function fetchLiveFeed(): Promise<FeedItem[]> {
     try {
       const reddit = await fetchReddit(REDDIT_LANES);
       return capLive(dedupe(reddit), 20);
     } catch {
       return []; // demo floor: never let live break the app
     }
   }
   ```
   - Import `fetchReddit` from `./sources/reddit`.
   - `dedupe(items)`: keep first per normalized key `(url || title).toLowerCase().trim()`.
   - `capLive(items, n)`: `items.slice(0, n)`.
   - `REDDIT_LANES` already satisfies the `RedditLane` shape structurally; pass directly.
3. Leave `HERO_FEED`, `REDDIT_LANES`, `applyShield` unchanged. Remove the now-stale
   `return []` placeholder comment; keep the `TODO(loop)` lines for the still-unbuilt
   You.com / classifier work but drop the Reddit bullet that this ticket fulfills.

## `vite.config.ts` (modify)

Add a `server.proxy` entry:

```ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/reddit": {
        target: "https://www.reddit.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/reddit/, ""),
        headers: { "User-Agent": "inner-weather/0.1 (dev proxy)" },
      },
    },
  },
});
```

`changeOrigin` makes Reddit see its own host; `rewrite` strips the `/reddit` prefix so
`/reddit/r/aww/hot.json` → `https://www.reddit.com/r/aww/hot.json`; the `User-Agent`
avoids Reddit's anonymous-browser 403s.

## Ordering of changes (dependency-correct)

1. `vite.config.ts` proxy — transport must exist before the adapter can succeed in dev.
2. `feed.ts` — add `thumbnail?` to `FeedItem` (the type `reddit.ts` imports).
3. `src/sources/reddit.ts` — adapter (depends on the `FeedItem` type).
4. `feed.ts` — implement `fetchLiveFeed()` (depends on `reddit.ts`).
5. Typecheck + dev boot.

Steps 2 and 4 are the same file; do the type edit first so reddit.ts typechecks, then the
function body once the adapter exists.

## Interfaces touched (summary)

- **New export:** `fetchReddit`, `RedditLane` from `src/sources/reddit.ts`.
- **Changed export:** `FeedItem` gains optional `thumbnail`; `fetchLiveFeed` behavior.
- **No breaking changes:** all additions optional/additive; `App.tsx` compiles unchanged.
