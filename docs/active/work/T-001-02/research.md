# T-001-02 · Research — reddit-live-feed

Descriptive map of the codebase as it relates to wiring real Reddit posts into the feed.
No solutions proposed here; that is Design.

## Ticket in one line

Replace the placeholder `fetchLiveFeed()` (`src/feed.ts:53`) with a real implementation
that fetches public Reddit posts for each `REDDIT_LANES` entry, maps them to `FeedItem`,
and appends them to the curated `HERO_FEED` — deduped and capped ~20 — without ever
breaking the demo floor.

## Relevant files

| File | Role |
| --- | --- |
| `src/feed.ts` | `FeedItem` model, `HERO_FEED`, `REDDIT_LANES`, `fetchLiveFeed()`, `applyShield()`. The ticket's primary edit site. |
| `src/App.tsx` | Mounts the feed; calls `fetchLiveFeed().then(setLive)` once on mount; merges `HERO_FEED + live`, sorts by tier, applies shield, renders cards. |
| `src/tiers.ts` | 3 tiers + ceilings (FOG 2 / PERSEVERANCE 3 / SHARP 5). Unchanged by this ticket but defines what "shielded" means. |
| `src/sources/` | **Does not exist yet.** CLAUDE.md lists it as created-by-tickets. This ticket creates `src/sources/reddit.ts` as the first file in it. |
| `vite.config.ts` | Bare `react()` plugin only. **No dev proxy exists** (see Constraints). |
| `.env.local` | You.com + Oura keys filled; InsForge filled too. **Reddit needs no key.** |

## The data model (`src/feed.ts:5-15`)

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
}
```

Notable: `url` and `body` are optional; the curated set uses `emoji` as a thumbnail.
There is **no `thumbnail` / image field** on `FeedItem` today — only `emoji`. The ticket
says "thumbnail if present", so this is an open gap (see Constraints/Assumptions).

## The lanes (`src/feed.ts:40-47`)

```ts
export const REDDIT_LANES = [
  { sub: "aww",             intensity: 1, kind: "cute" },
  { sub: "EarthPorn",       intensity: 1, kind: "nature" },
  { sub: "CozyPlaces",      intensity: 2, kind: "art" },
  { sub: "todayilearned",   intensity: 3, kind: "news" },
  { sub: "unpopularopinion",intensity: 5, kind: "hottake" },
  { sub: "rant",            intensity: 5, kind: "hottake" },
];
```

6 lanes. Calm subs (intensity 1–2) sit under every ceiling; the two intensity-5 hottake
subs are shielded in FOG (ceiling 2) and PERSEVERANCE (ceiling 3) and only surface in
SHARP (ceiling 5). This is exactly the shield-exercising behavior the ticket wants.

`limit=4` × 6 lanes = up to 24 raw items → must be deduped + capped to ~20.

## Current `fetchLiveFeed()` and its caller

`src/feed.ts:53-56` — returns `[]`. A `TODO(loop)` comment above it (lines 49-52) sketches
the intended `fetchReddit(lane)` signature: `GET .../r/{sub}/hot.json?limit=5` (the ticket
overrides to `limit=4`).

`src/App.tsx:20-22`:
```ts
useEffect(() => {
  fetchLiveFeed().then(setLive).catch(() => {});
}, []);
```
So the caller already swallows errors and starts from `live = []`. Whatever
`fetchLiveFeed()` returns is set into `live` state and merged in `useMemo` (`App.tsx:24-31`):
`[...HERO_FEED, ...live]`, sorted ascending/descending by intensity per tier, then
`applyShield(sorted, ceiling)`. Cards render with `it.emoji ?? "🗞️"` — items lacking an
emoji get the newspaper fallback automatically, so Reddit items without emoji render fine.

`id` is used as the React `key` (`App.tsx:88`) and as the override-set key
(`App.tsx:33,39-41`). **`id` must be unique and stable** across HERO_FEED + live, or React
keys collide and overrides target the wrong card.

## Reddit public JSON endpoint — what's known

- `https://www.reddit.com/r/{sub}/hot.json?limit=4` returns JSON with shape
  `{ data: { children: [ { kind: "t3", data: {...post} } ] } }`.
- Per-post fields of interest: `id`, `title`, `permalink` (relative; prefix with
  `https://www.reddit.com`), `url` (external link), `thumbnail` (often `"self"`,
  `"default"`, `"nsfw"`, or a URL), `over_18`, `stickied`, `is_self`.
- No auth/key required for the public `.json` endpoint.

## Constraints & assumptions surfaced

1. **CORS / User-Agent.** Browser `fetch` to `www.reddit.com/*.json` from `localhost`
   frequently returns 403 or is CORS-blocked (Reddit rate-limits anonymous browser
   origins and sometimes demands a `User-Agent`). The ticket explicitly anticipates this:
   "if blocked, add a Vite dev proxy in `vite.config.ts` like the Oura one." **There is no
   Oura proxy in the repo today** — `vite.config.ts` is bare. So the proxy pattern must be
   created fresh, not copied.
2. **No image field.** `FeedItem` has `emoji` but no `thumbnail`/image. "thumbnail if
   present" has nowhere to land without a model change or reuse of an existing field.
3. **No git repo.** The working dir is not a git repository, so the workflow's "commit
   incrementally" cannot literally run. Verification is `npx tsc -b` clean + dev boots.
4. **No test runner.** Verification is typecheck + manual dev-server boot only.
5. **Demo floor is sacred.** HERO_FEED + slider + flip must always work; every live fetch
   must be wrapped so a failure yields `[]` and the curated set still renders.
6. **TS strict.** `tsconfig.app.json` (Vite default) is strict; new code must be fully
   typed — no implicit `any` over the untyped Reddit JSON.
7. **`@types/node` present**, so `vite.config.ts` can use Node types for a proxy.

## What "done" looks like (from Acceptance Criteria)

- `src/sources/reddit.ts` exists; `fetchLiveFeed()` returns real Reddit posts.
- Posts appear alongside hero set; calm under ceiling, hottake shielded in FOG.
- Live feed deduped + capped (~20).
- A failed lane/fetch falls back cleanly; HERO_FEED + flip still work.
- `npx tsc -b` clean; dev boots.
