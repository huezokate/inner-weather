# T-001-01 · Plan — live-oura-readiness

Ordered, independently verifiable steps. There is no test runner; verification =
`npx tsc -b` clean + dev boots + manual observation. Each step is an atomic commit.

## Step 1 — Add the Vite dev proxy for Oura

**Edit** `vite.config.ts`: add `server.proxy['/oura']` → `https://api.ouraring.com`
with `changeOrigin: true` and `rewrite` stripping the `/oura` prefix (see structure.md §2).

**Verify**
- `npx tsc -b` clean (config is `.ts`, must still typecheck).
- `npm run dev` boots without error.
- (Optional sanity, manual) `curl` through the dev server:
  `curl -s "http://localhost:5173/oura/v2/usercollection/personal_info" -H "Authorization: Bearer $VITE_OURA_TOKEN"`
  should return JSON, not a CORS/HTML error — confirms the proxy path forwards.

**Commit:** `T-001-01: add Vite dev proxy for Oura API (CORS)`

## Step 2 — Create the Oura adapter

**Create** `src/sources/oura.ts` exporting `fetchOuraReadiness(): Promise<number | null>`
per structure.md §1:
- Empty-token short-circuit → `null` (no fetch).
- 7-day window, `start_date`/`end_date` as `YYYY-MM-DD`.
- Relative URL `/oura/v2/usercollection/daily_readiness` (uses Step 1 proxy).
- `Authorization: Bearer <token>` header.
- `!res.ok` → warn + `null`. Scan `data` from the end for first numeric `score`.
- Whole body in try/catch → warn + `null`. Never throws.

**Verify**
- `npx tsc -b` clean (strict flags: explicit return type, no unused locals, catch
  binding logged). Unused export is fine at this step.

**Commit:** `T-001-01: add Oura daily-readiness source adapter`

## Step 3 — Wire Oura into App and add the slider-wins gate

**Edit** `src/App.tsx` per structure.md §3:
- Import `useRef` and `fetchOuraReadiness`.
- Add `const userTouched = useRef(false);`.
- New mount effect: `fetchOuraReadiness().then(s => { if (s != null && !userTouched.current) setScore(s); }).catch(() => {});`
- Slider `onChange` also sets `userTouched.current = true`.

**Verify (behavioral — the acceptance criteria)**
- `npx tsc -b` clean.
- `npm run dev` boots.
- On load with token set: header score updates from `61` to the real Oura value
  (confirm in browser; the tier/theme should shift to match).
- Drag the slider: score follows the slider and a late Oura response does **not**
  overwrite it (slider override holds).
- Flip button still toggles Sharp↔Fog and cards un-blur/reorder.
- Simulate failure: temporarily blank `VITE_OURA_TOKEN` (or go offline) → no crash,
  score stays at default `61`, HERO_FEED + slider + flip all still work; one console
  line notes the skip/failure.

**Commit:** `T-001-01: seed readiness from Oura on load, slider overrides`

## Testing strategy

- **Unit tests:** none — no runner is configured in this repo (CLAUDE.md). Adding
  one is out of scope for a hackathon ticket.
- **Type safety as the contract test:** `npx tsc -b` enforces the `Promise<number |
  null>` seam and strict-mode correctness. This is the primary automated gate.
- **Manual integration checks** (the verify blocks above) cover the four acceptance
  criteria: adapter exists + fetches behind try/catch; real score on load; slider
  overrides; demo floor survives Oura failure/missing token.
- **Negative-path check is explicit** (blank token / offline) because the guardrail
  "never let a live source break the demo" is the highest-risk property.

## Verification criteria (definition of done)

- [ ] `src/sources/oura.ts` exists; fetch wrapped in try/catch; returns `number|null`.
- [ ] With token set, header reflects real Oura readiness on load.
- [ ] Slider still overrides after load (userTouched gate verified by dragging).
- [ ] HERO_FEED + flip work when Oura fails or token is missing.
- [ ] `npx tsc -b` clean; `npm run dev` boots.

## Rollback / risk notes

- Every step is independently revertable; only Step 3 changes runtime behavior.
- If the proxy misbehaves in an unexpected environment, Step 3's `null` fallback
  means the app degrades to the curated demo floor — no hard failure path.
- If Oura returns an unexpected payload shape, the from-the-end numeric-score scan
  yields `null` rather than throwing.

## Deviations

Record any deviation from this plan in `progress.md` during Implement, with rationale.
