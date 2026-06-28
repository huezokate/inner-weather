# T-001-03 · Structure — youcom-live-lane

The blueprint: files touched, interfaces, and ordering. Not code — the shape of the code.

## Change set

| File | Action | Why |
| --- | --- | --- |
| `src/sources/youcom.ts` | **create** | The You.com adapter: queries, types, fetch, map, error isolation. |
| `vite.config.ts` | **modify** | Add `/youcom` dev proxy (CORS — Research C1). |
| `src/feed.ts` | **modify** | Import `fetchYouCom`; merge it into `fetchLiveFeed()` ahead of Reddit; drop the stale You.com `TODO(loop)` line. |
| `src/App.tsx` | **unchanged** | Render path already handles emoji-less, thumbnail-bearing live items (D6). |
| `src/tiers.ts` | **unchanged** | Ceilings already define the shield. |

No files deleted. `FeedItem` is **not** modified — `thumbnail` already exists (T-001-02).

## `src/sources/youcom.ts` (new) — public + internal surface

Header comment in the house style (provenance, key, error-isolation, demo-floor promise).

### Public exports

```ts
export interface YouComQuery {
  query: string;
  intensity: number;          // source-level prior (D2)
  kind: FeedItem["kind"];
}

/** The two lanes: one calm (prior 2), one trending (prior 5). */
export const YOUCOM_QUERIES: YouComQuery[];

/** Both queries, error-isolated. Never rejects; empty key → []. */
export async function fetchYouCom(): Promise<FeedItem[]>;
```

### Internal surface

```ts
// Dev → same-origin Vite proxy; build → direct host (CORS-walled, demo runs in dev).
const YOUCOM_BASE = import.meta.env.DEV ? "/youcom" : "https://ydc-index.io";

interface RawYouComResult {           // one entry of results.web[]
  url: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  snippets?: string[];
}
interface YouComResponse { results?: { web?: RawYouComResult[] } }

function isImageUrl(s?: string): boolean;              // startsWith("http") — same rule as reddit
function slug(s: string): string;                     // query → stable id fragment ([a-z0-9]+ → "-")
function toFeedItem(r: RawYouComResult, q: YouComQuery, i: number): FeedItem;
async function fetchQuery(q: YouComQuery, key: string): Promise<FeedItem[]>;  // one query, try/catch → []
```

### `YOUCOM_QUERIES` content (D2)

```ts
[
  { query: "wholesome calming nature",     intensity: 2, kind: "nature" },
  { query: "biggest tech hot takes today", intensity: 5, kind: "hottake" },
]
```

### `fetchYouCom` control flow

1. Read `import.meta.env.VITE_YOU_API_KEY`. If falsy → `console.info(...)`, return `[]` (D7).
2. `Promise.allSettled(YOUCOM_QUERIES.map((q) => fetchQuery(q, key)))`.
3. `flatMap` fulfilled values; rejected/failed → contribute nothing.
4. (No top-level throw possible, but wrap in try/catch → `[]` as a belt-and-suspenders guard.)

### `fetchQuery` control flow

1. Build `${YOUCOM_BASE}/v1/search?query=${encodeURIComponent(q.query)}&count=5`.
2. `fetch(url, { headers: { "X-API-Key": key } })`.
3. `if (!res.ok) { console.warn(...); return []; }`.
4. Parse JSON as `YouComResponse`; `const web = json.results?.web ?? []`.
5. Filter to entries with a non-empty `title` and a `url`; `.map((r, i) => toFeedItem(r, q, i))`.
6. `catch → console.warn(...); return []`.

### `toFeedItem` mapping (D4)

```
id:        `you-${slug(q.query)}-${i}`
intensity: q.intensity
kind:      q.kind
title:     r.title.trim()
body:      r.description?.trim() || r.snippets?.[0]
source:    "you.com"
url:       r.url
thumbnail: isImageUrl(r.thumbnail_url) ? r.thumbnail_url : undefined
```

## `vite.config.ts` (modify)

Add a third proxy entry beside `/reddit` and `/oura`:

```ts
'/youcom': {
  target: 'https://ydc-index.io',
  changeOrigin: true,
  rewrite: (p) => p.replace(/^\/youcom/, ''),
},
```

No User-Agent header needed (unlike Reddit). `changeOrigin` so `ydc-index.io` sees its own
host. The client-sent `X-API-Key` passes through untouched.

## `src/feed.ts` (modify)

1. **Import:** `import { fetchYouCom } from "./sources/youcom";` next to the Reddit import.
2. **TODO cleanup:** remove the `fetchYouCom(...)` line from the `TODO(loop)` block
   (`src/feed.ts:52-54`); leave the `classifyIntensity` line (that's a later ticket).
3. **`fetchLiveFeed()` body** becomes:

```ts
export async function fetchLiveFeed(): Promise<FeedItem[]> {
  try {
    const [you, reddit] = await Promise.all([
      fetchYouCom(),
      fetchReddit(REDDIT_LANES),
    ]);
    // You.com first so the live web lane survives the cap (see design D5).
    return dedupe([...you, ...reddit]).slice(0, 20);
  } catch {
    return []; // demo floor: never let a live source break the app
  }
}
```

`dedupe()` and the `.slice(0, 20)` cap are reused unchanged (AC #3).

## Module boundaries & invariants

- **`youcom.ts` depends only on** `FeedItem` (type-only import from `../feed`) — same as
  `reddit.ts`. No reverse dependency; `feed.ts` imports the function, not the internals.
- **Totality:** `fetchYouCom` and `fetchQuery` never reject — every path returns `FeedItem[]`.
- **Id namespace:** `you-*` is disjoint from `h*` and `reddit-*`; React keys + override keys
  stay unique (Research render-path note).
- **No `FeedItem` / `App.tsx` / `tiers.ts` change** → the demo floor is structurally
  untouchable by this ticket.

## Ordering of changes (feeds the Plan)

1. `vite.config.ts` proxy (transport must exist before the adapter can succeed in dev).
2. `src/sources/youcom.ts` (the adapter, self-contained, typechecks alone).
3. `src/feed.ts` merge (wires the adapter into the pipeline).
4. Verify: `npx tsc -b`, dev boot, flip check.
