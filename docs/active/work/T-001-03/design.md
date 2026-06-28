# T-001-03 · Design — youcom-live-lane

Decisions and rationale, grounded in Research. Each decision names the alternative rejected.

## Goal

A You.com Search lane that drops real, current web results into the feed — one calm query,
one trending query — mapped to `FeedItem`s, shielded correctly by tier, merged with Reddit,
and incapable of breaking the demo floor.

## D1 — Adapter shape: mirror `reddit.ts`

A new `src/sources/youcom.ts` exporting one async function that returns `FeedItem[]` and
never rejects. The codebase already has two adapter precedents (`reddit.ts`, `oura.ts`); a
third following the same contract keeps `fetchLiveFeed()` symmetric and the failure model
uniform.

- **Chosen:** `export async function fetchYouCom(): Promise<FeedItem[]>` — queries defined as
  a module-level constant inside `youcom.ts`, like `REDDIT_LANES` lives near Reddit.
- **Rejected — pass queries in from `feed.ts`** (à la `fetchReddit(REDDIT_LANES)`): the two
  queries are intrinsic to the You.com lane's intent (calm vs trending priors), not a config
  `feed.ts` should own. Keeping them in `youcom.ts` co-locates the prior with the query. A
  `YOUCOM_QUERIES` const is still exported for visibility/testing.
- **Rejected — a generic `fetchSearch(query, hint)` shared with future sources:** premature;
  only You.com uses this endpoint. YAGNI.

## D2 — Query set & intensity priors

Two queries, each with a source-level intensity prior (the LLM classifier that refines
per-item intensity is a later ticket — same stance as Reddit's lane priors, D8 of T-001-02):

| Query | Prior | kind | Shield behavior |
| --- | --- | --- | --- |
| `"wholesome calming nature"` | **2** (calm) | `nature` | Passes every ceiling (FOG 2 / PERS 3 / SHARP 5) — always visible. |
| `"biggest tech hot takes today"` | **5** (agitating) | `hottake` | Shielded in FOG & PERSEVERANCE; surfaces only in SHARP. |

- **Rationale:** This pair *is* the shield demo in miniature — calm content that's always
  through, trending content that the ring gates. It mirrors the curated hero spread (calm 1–2
  vs hottake 5) so a Sharp↔Fog flip visibly reshuffles You.com cards too. Queries and priors
  come verbatim from the ticket / BUILD_PLAN Task 3.
- **Rejected — calm prior 1:** reserve 1 for the hand-curated "soothing" floor; a live web
  result is "calm" (2) at best, not guaranteed soothing. 2 still clears every ceiling, so
  behavior is identical while being honest about provenance.

## D3 — Transport: Vite dev proxy `/youcom`, client sends `X-API-Key`

Research proved cross-origin browser fetch is CORS-blocked (no ACAO header; `OPTIONS`
preflight → 403). Add a `/youcom` → `https://ydc-index.io` proxy in `vite.config.ts`, exactly
like `/oura`. In dev, base = `/youcom`; in a real build, base = `https://ydc-index.io`.

- **Chosen:** client sets `X-API-Key` and calls the same-origin `/youcom/...`; Vite forwards
  the header server-side. A same-origin request never preflights, so the custom header is
  fine — this is precisely how `oura.ts` sends `Authorization` through `/oura`.
- **Rejected — inject the key in the proxy config** (so it never touches client code): would
  diverge from the established Oura pattern, and `import.meta.env` isn't ergonomically
  readable inside `vite.config.ts` for a per-request header. The key is already a `VITE_*`
  var (in the bundle regardless), so injecting it in the proxy buys no real secrecy for the
  dev demo. Documented as a deploy-time concern instead (D7).
- **Rejected — direct cross-origin fetch with a CORS proxy service:** adds a third-party
  dependency and another failure mode; the dev proxy is zero-dependency and already the house
  pattern.

## D4 — Result mapping → `FeedItem`

Map `results.web[]` (cap to the query's `count`) to `FeedItem`:

```
id:        `you-${slug(query)}-${index}`   // unique + stable across HERO_FEED & reddit
intensity: query.intensity                  // the prior
kind:      query.kind
title:     result.title.trim()
body:      result.description || result.snippets?.[0]   // optional
source:    "you.com"
url:       result.url
thumbnail: isImageUrl(result.thumbnail_url) ? result.thumbnail_url : undefined
```

- **`id` scheme:** `you-` prefix guarantees no collision with `h*` (hero) or `reddit-*` ids.
  Index within the query keeps it stable across renders (the list is deterministic per fetch).
- **`thumbnail` guard:** reuse the same `startsWith("http")` sanity check Reddit uses
  (`isImageUrl`) — You.com sometimes returns a generic site-icon URL, which is still a valid
  http URL, so it passes; junk/empty values are dropped. App renders emoji-first anyway (D6).
- **Rejected — render `favicon_url`/`snippets` specially:** out of scope; the card UI is
  emoji-first and demo-frozen. Store `body`/`thumbnail` for a later UI ticket; don't touch
  `App.tsx`.

## D5 — Merge into `fetchLiveFeed()`: You.com first, then Reddit, then dedupe + cap

```ts
const [you, reddit] = await Promise.all([fetchYouCom(), fetchReddit(REDDIT_LANES)]);
return dedupe([...you, ...reddit]).slice(0, 20);
```

- **You.com leads the array** so the $1K prize integration is guaranteed to survive the
  `.slice(0, 20)` cap even when Reddit returns a full ~24 items (Research C4 / AC #2).
- **`Promise.all` over sequential `await`:** both adapters are already total (never reject —
  each returns `[]` on failure), so running them concurrently is safe and faster. The outer
  `try/catch → []` stays as the last-resort guard.
- **dedupe + cap unchanged:** reuse the existing `dedupe()` and `.slice(0, 20)` verbatim — AC
  #3 requires the Reddit-era behavior to hold. You.com and Reddit rarely share a URL, but
  `dedupe` covers the edge.
- **Rejected — interleave/round-robin the two sources:** more code for no demo benefit; the
  per-tier intensity sort in `App.tsx` already reorders everything, so concat order only
  matters for the cap, which "You.com first" resolves simply.

## D6 — Render path untouched

No changes to `App.tsx`. You.com items flow through the existing merge → sort → shield →
render. They have no `emoji`, so they get the `🗞️` fallback; `intensity` drives the shield;
`source` shows as `you.com` in the card meta line (`i{n} · {source}`). The demo-critical card
layout and flip stay byte-for-byte unchanged.

## D7 — Empty-key & failure handling

- If `VITE_YOU_API_KEY` is empty/undefined: log an `info` and return `[]` (mirrors
  `oura.ts`). Lane silently absent; Reddit + HERO_FEED carry the feed.
- Per-query try/catch (network, non-2xx, bad JSON) → that query yields `[]`; the other still
  contributes. Use `Promise.allSettled` across the two queries so one failing query can't sink
  the other (mirrors `fetchReddit`'s per-lane isolation).
- A top-level try/catch in `fetchYouCom` returns `[]` as the final backstop.
- **Key exposure note (run summary):** the key ships in the client bundle via `VITE_`; a
  public deploy must move the call behind a serverless function / server proxy. Dev demo is
  fine.

## D8 — Verification strategy (no test runner)

`npx tsc -b` clean + dev boots + a live probe of the endpoint already succeeded in Research.
Confirm at least one `you.com`-sourced card renders and that the trending card is shielded in
FOG and revealed in SHARP via the flip. Details in Plan.

## Summary of decisions

D1 mirror reddit adapter · D2 calm(2)/trending(5) queries · D3 `/youcom` dev proxy, client
sends key · D4 map `results.web[]`, reuse `thumbnail` · D5 You.com-first merge then existing
dedupe+cap · D6 no `App.tsx` change · D7 empty-key + per-query isolation · D8 typecheck +
dev-boot + flip check.
