# Inner Weather — Build Plan (loop-ready)

Status: **wow core DONE** (feed + 3-tier morph + shield + Sharp↔Fog flip, runs with zero keys on
the curated HERO_FEED). Concept: `../INNER_WEATHER_CONCEPT.md`. Run: `npm run dev` → localhost:5173.

The loop should execute the tasks below **in order**, top to bottom. Each has a file target and an
acceptance check. Skip a task only if its key is missing (see Task 0) — never block the others.

---

## Task 0 — Preflight (do first every run)
- Read `.env.local`. Record which of `VITE_YOU_API_KEY`, `VITE_OURA_TOKEN`,
  `VITE_INSFORGE_BASE_URL`/`VITE_INSFORGE_ANON_KEY` are filled.
- If a key is empty, **skip that integration and leave its fallback active** (curated set / slider /
  localStorage). Note it in the run summary. Do not fail the build over a missing key.
- Always end a run with: `npx tsc -b` clean + dev server boots.

## Task 1 — Live Oura readiness  *(needs VITE_OURA_TOKEN)*
- File: new `src/sources/oura.ts`. Reuse the pattern from `../../oura-mcp/src/provider/oura_provider.ts`.
- GET `https://api.ouraring.com/v2/usercollection/daily_readiness?start_date={today}&end_date={today}`
  with header `Authorization: Bearer ${VITE_OURA_TOKEN}`. Take latest `.data[].score`.
- In `App.tsx`: on mount, set `score` from Oura; keep the slider as a manual override.
- ⚠️ CORS: Oura may block browser calls. If so, add a tiny Vite dev proxy in `vite.config.ts`
  (`server.proxy['/oura'] → https://api.ouraring.com`) and call `/oura/...`.
- Accept: with token set, the header score reflects real Oura data on load.

## Task 2 — Reddit feed (no key)  *(always run)*
- File: `src/sources/reddit.ts`. For each `REDDIT_LANES` entry: GET
  `https://www.reddit.com/r/{sub}/hot.json?limit=4`, map posts → `FeedItem`
  (title, url, thumbnail if present, `intensity` = lane prior, `source: "reddit"`).
- Wire into `fetchLiveFeed()` in `feed.ts`. Dedupe; cap ~20 live items.
- Accept: real Reddit posts appear alongside the hero set; calm subs slot under the ceiling, hot-take
  subs get shielded in Fog.

## Task 3 — You.com live lane  *(needs VITE_YOU_API_KEY — the $1K)*
- File: `src/sources/youcom.ts`. GET `https://ydc-index.io/v1/search` with header
  `X-API-Key: ${VITE_YOU_API_KEY}`, `query` + `count=5`. Run two queries: one calm
  ("wholesome calming nature"), one trending/hot ("biggest tech hot takes today").
- Map results → `FeedItem` (`source: "you.com"`). Calm query → low intensity prior; trending → high.
- ⚠️ Key exposure: client-side is fine for the local demo. For a public deploy, move to a Vite
  proxy or serverless function so the key isn't in the bundle.
- Accept: real current web results show in the feed, labeled `you.com`, correctly shielded by tier.

## Task 4 — InsForge backend  *(needs INSFORGE vars — the $500)*
- `npm i @insforge/sdk`. File: `src/lib/insforge.ts` → `createClient({ baseUrl, anonKey })`.
- Provision via MCP/CLI: table `diary` (id, created_at, readiness int, tier text, shielded_count int,
  overrides jsonb). Add RLS allowing the anon/auth role to insert+select (RLS is the usual gotcha).
- In `App.tsx`: on score settle (debounced), insert a `diary` row. Add a tiny "weather diary"
  strip showing readiness over recent entries (the NASI Memory pillar).
- Optional auth: `auth.signInWithPassword` gate so the diary is per-user.
- Accept: changing readiness writes a row; the diary strip reads them back.

## Task 5 — InsForge AI intensity classifier  *(needs INSFORGE + `cli ai setup`)*
- File: `src/lib/classify.ts`. Send live items (Reddit + You.com titles) to the InsForge AI gateway
  with a prompt: "Rate 1–5 how activating/agitating this content is. Return JSON [{id,intensity}]."
- Replace source-prior intensities with model scores for live items (keep hero set hand-tagged).
- Accept: live items get sensible 1–5 scores; using InsForge twice (DB + gateway) is demonstrable.

## Task 6 — Polish + demo  *(always, last)*
- Tune the Sharp↔Fog flip timing so shielded cards visibly un-blur and reorder (the wow). Verify the
  rain/fog/glow morph reads on a projector (high contrast).
- Make one *beautiful* Fog state and one *beautiful* Sharp state with the hero set.
- Record a GIF of the flip (browser tool `gif_creator`, name `inner-weather-flip.gif`).
- Draft the ≤3-min demo script in `../INNER_WEATHER_CONCEPT.md` §1 wording.
- Deploy: `npm run build` → Netlify/GitHub Pages (match Kate's other projects). Move secrets to a
  proxy/function before any public deploy.

---

## Guardrails for the loop
- The **curated HERO_FEED + slider + flip must always work** — it's the demo floor. Never let a live
  source break it; wrap every fetch in try/catch and fall back.
- Keep it 3 tiers, ceilings 2 / 3 / 5 (Fog / Perseverance / Sharp). Don't add tiers.
- Don't add OAuth into personal social accounts — public sources only.
- After each task: `npx tsc -b` clean, dev boots, commit with a one-line message.
