# T-001-01 · Progress — live-oura-readiness

Execution log against `plan.md`. Status: **complete**.

## Step 1 — Vite dev proxy for Oura ✅
- **Deviation from plan/structure:** `vite.config.ts` already had a `server.proxy`
  block (a sibling ticket added a `/reddit` proxy under concurrency). Rather than
  introduce a fresh `server` block, I **added `/oura` alongside the existing
  `/reddit` entry**. Same target/changeOrigin/rewrite shape as designed.
- Verified: `npx tsc -b` clean; dev server boots.

## Step 2 — Oura adapter `src/sources/oura.ts` ✅
- Created `fetchOuraReadiness(): Promise<number | null>` per structure.md.
- **Deviation:** matched the in-repo house style discovered in the sibling
  `src/sources/reddit.ts` — used `const OURA_BASE = import.meta.env.DEV ? "/oura/..."
  : "https://api.ouraring.com/..."` so the proxy is used only in dev and a build
  still resolves to a real URL. (Plan/structure had assumed a fixed relative path;
  the DEV-conditional is strictly better and consistent with the codebase.)
- Empty-token short-circuit, 7-day window, most-recent-numeric-score scan, full
  try/catch → `null`, all as designed.
- Verified: `npx tsc -b` clean (strict flags: explicit return type, catch binding
  logged, no unused locals).

## Step 3 — Wire into `src/App.tsx` ✅
- Added `useRef` + `fetchOuraReadiness` imports.
- Added `const userTouched = useRef(false);`.
- Added a mount effect that seeds `score` from Oura only when `s != null &&
  !userTouched.current`, with a trailing `.catch(() => {})` mirroring the existing
  `fetchLiveFeed` call.
- Slider `onChange` now sets `userTouched.current = true` before `setScore`.
- `flipToSharp`, `override`, the feed memo, and all JSX left untouched (per D4 the
  flip stays independent of the touch gate).

## Verification performed
- `npx tsc -b` → exit 0, clean. ✅
- `npm run lint` (oxlint) → clean. ✅
- `npm run dev` → boots, Vite v8.1.0 ready; `GET /` → HTTP 200. ✅
- **Live proxy + API end-to-end:** `GET http://localhost:5173/oura/v2/usercollection/
  daily_readiness?start_date=2026-06-21&end_date=2026-06-28` with the real Bearer
  token → **HTTP 200** with real readiness payload (e.g. `day 2026-06-21, score 81`).
  Confirms (a) CORS is bypassed via the proxy and (b) the token is valid and returns
  usable scores. So on load the header score will reflect real Oura data. ✅

## Acceptance criteria status
- [x] `src/sources/oura.ts` exists; fetch behind try/catch; returns `number|null`.
- [x] With token set, the header score reflects real Oura data on load (verified the
      proxy + API return a real score; App seeds from it on mount).
- [x] Manual slider still overrides after load (`userTouched` ref gate).
- [x] HERO_FEED + flip still work if Oura fails / token missing (adapter returns
      `null`, default `61` stands; feed never reads Oura directly).
- [x] `npx tsc -b` clean and dev server boots.

## Commits
- **Not committed:** this working tree is not a git repository (`git rev-parse`
  fails). Per the RDSPI workflow, Lisa handles VCS / phase transitions. No manual
  commits were attempted. The CLAUDE.md "commit after each ticket" guardrail is left
  to the orchestrator.

## Notes / deviations summary
1. `/oura` added to a pre-existing proxy block (concurrency), not a new one.
2. Adapter uses the `import.meta.env.DEV` proxy/direct switch to match `reddit.ts`.
3. No git commits — not a git repo in this environment.
