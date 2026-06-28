# T-001-03 · Research — youcom-live-lane

Descriptive map of the codebase as it relates to adding a You.com live lane to the feed.
No solutions proposed here; that is Design.

## Ticket in one line

Add `src/sources/youcom.ts` that runs two You.com Search queries (one calm, one trending),
maps the web results to `FeedItem`s labeled `you.com`, and folds them into `fetchLiveFeed()`
alongside the Reddit results — deduped, capped ~20 — without ever breaking the demo floor.

## Relevant files

| File | Role |
| --- | --- |
| `src/feed.ts` | `FeedItem` model, `HERO_FEED`, `REDDIT_LANES`, `dedupe()`, `fetchLiveFeed()`, `applyShield()`. Primary edit site — the You.com results must merge here. |
| `src/sources/reddit.ts` | The pattern to copy: an error-isolated source adapter exporting `fetchReddit(lanes)`. Returns `FeedItem[]`, never rejects. |
| `src/sources/oura.ts` | Second adapter precedent — reads a `VITE_*` key, skips cleanly when absent, sends an auth header through a Vite dev proxy. |
| `src/sources/youcom.ts` | **Does not exist yet.** This ticket creates it. |
| `src/App.tsx` | Mounts the feed; `fetchLiveFeed().then(setLive)` once on mount; merges `HERO_FEED + live`, sorts by tier, applies shield, renders cards (emoji-first). |
| `src/tiers.ts` | 3 tiers + ceilings (FOG 2 / PERSEVERANCE 3 / SHARP 5). Defines what "shielded" means; unchanged by this ticket. |
| `vite.config.ts` | Has `/reddit` and `/oura` dev proxies. **No `/youcom` proxy yet** — needed (see Constraints). |
| `.env.local` | `VITE_YOU_API_KEY` is filled and verified live (65-char key). |

## The data model (`src/feed.ts:7-18`)

```ts
interface FeedItem {
  id: string;
  intensity: number;                 // 1 soothing … 5 agitating
  kind: "cute"|"art"|"nature"|"poem"|"news"|"hottake"|"hype";
  title: string;
  body?: string;
  source: string;                    // "curated" | "reddit" | "you.com" | "youtube"
  emoji?: string;                    // stand-in thumbnail for curated set
  url?: string;
  thumbnail?: string;                // real image URL from a live source (added in T-001-02)
}
```

Notable: `source: "you.com"` is already an anticipated value in the doc-comment. `thumbnail`
already exists (added by T-001-02 for Reddit) — You.com returns `thumbnail_url`, so it can
reuse this field with **no model change**. `body` is free for a description/snippet.

## The merge point (`src/feed.ts:69-76`)

```ts
export async function fetchLiveFeed(): Promise<FeedItem[]> {
  try {
    const reddit = await fetchReddit(REDDIT_LANES);
    return dedupe(reddit).slice(0, 20); // append to HERO_FEED; never replace it
  } catch {
    return [];
  }
}
```

T-001-02 left this Reddit-only. The ticket says to add You.com results "alongside the Reddit
results; keep the same dedupe + ~20 cap." So the shape becomes: gather both sources →
concatenate → `dedupe()` → `.slice(0, 20)`. `dedupe()` (`src/feed.ts:57-67`) is first-wins on
normalized `url||title`, so **array order decides which source survives the cap** (see
Constraints).

## The caller and render path (`src/App.tsx`)

`App.tsx:24-26` calls `fetchLiveFeed().then(setLive).catch(() => {})` once on mount —
already error-swallowing, starts from `live = []`. The merge in `useMemo` (`App.tsx:39-46`)
is `[...HERO_FEED, ...live]`, sorted by intensity (desc in SHARP, asc otherwise), then
`applyShield(sorted, tier.ceiling)`. Cards render `it.emoji ?? "🗞️"` (`App.tsx:109`) — You.com
items have no emoji, so they get the 🗞️ fallback automatically. `id` is the React `key` and
the override-set key, so **You.com ids must be unique and stable** across HERO_FEED + Reddit.

## You.com Search API — verified live against this key

`GET https://ydc-index.io/v1/search?query=<q>&count=5` with header `X-API-Key: <key>`.
Probed live (HTTP 200). Response shape:

```jsonc
{
  "results": {
    "web": [
      {
        "url": "https://…",
        "title": "…",
        "description": "…",
        "thumbnail_url": "https://…",          // may be a generic site icon
        "original_thumbnail_url": "https://…",
        "favicon_url": "https://you.com/favicon?domain=…",
        "snippets": ["…", "…"]
      }
    ]
  }
}
```

Fields of interest per result: `url`, `title`, `description`, `thumbnail_url`, `snippets[]`.
`count=5` per query × 2 queries = up to 10 raw You.com items.

## Constraints & assumptions surfaced

1. **CORS — proxy required.** Probed `ydc-index.io`: the GET response carries **no
   `Access-Control-Allow-Origin`** header and the CORS preflight (`OPTIONS`) returns **403**.
   `X-API-Key` is a non-simple header, so a cross-origin browser `fetch` would trigger a
   preflight and be blocked. A same-origin Vite dev proxy (`/youcom` → `https://ydc-index.io`)
   is needed — identical to the existing `/oura` and `/reddit` proxies. The client sends
   `X-API-Key`; the proxy forwards it server-side (same pattern as Oura's `Authorization`).
2. **Key exposure.** `VITE_*` vars are inlined into the client bundle. Fine for a dev-served
   local demo; a public deploy needs a serverless/proxy hop so the key isn't shipped. Must be
   called out in the run summary (ticket ⚠️).
3. **Empty-key path.** If `VITE_YOU_API_KEY` is absent, the lane must skip and return `[]` —
   never fail the build. (It is currently filled, but the guard is required.)
4. **Dedupe order vs the ~20 cap.** Reddit can emit up to ~24 raw items; You.com up to 10.
   With a hard `.slice(0, 20)`, whichever source is concatenated first wins the cap. To
   guarantee the prize integration is visibly present (AC #2), You.com should lead the array.
5. **Demo floor is sacred.** Every fetch wrapped so failure → `[]`; HERO_FEED + slider + flip
   must always render.
6. **No git repo / no test runner.** Verification is `npx tsc -b` clean + dev boots (per
   CLAUDE.md). "Commit incrementally" can't literally run.
7. **TS strict.** The untyped You.com JSON must be given local interfaces — no implicit `any`.
8. **Reddit must keep working.** T-001-02's `fetchReddit` + dedupe + cap behavior must be
   preserved; this ticket only adds a second contributor to the same pipeline.

## What "done" looks like (from Acceptance Criteria)

- `src/sources/youcom.ts` exists; both calm + trending queries run behind try/catch.
- Real current web results show in the feed labeled `you.com`, correctly shielded by tier.
- Reddit lane from T-001-02 still works; dedupe + cap still hold.
- Missing key / failed call falls back cleanly; HERO_FEED + flip still work.
- `npx tsc -b` clean; dev boots.
