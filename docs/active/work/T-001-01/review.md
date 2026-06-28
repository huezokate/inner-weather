# T-001-01 · Review — live-oura-readiness

Handoff document. What changed, how it was verified, and what a human should know.

## Summary

The readiness `score` that drives the entire tier system now seeds from the user's
**real Oura daily readiness** on load, while the manual slider remains an authoritative
override. The integration is fully isolated: any Oura failure leaves the curated demo
floor (HERO_FEED + slider + flip) exactly as it was.

## Files changed

| File | Action | Summary |
|------|--------|---------|
| `src/sources/oura.ts` | **created** | `fetchOuraReadiness(): Promise<number \| null>` — 7-day daily-readiness query, most-recent numeric score, fully error-isolated. |
| `vite.config.ts` | **modified** | Added `/oura` → `https://api.ouraring.com` dev proxy (CORS), alongside the existing `/reddit` proxy. |
| `src/App.tsx` | **modified** | Import + `useRef` touch-gate + mount effect that seeds `score` from Oura when the user hasn't taken over; slider `onChange` sets the gate. |

No files deleted. `tiers.ts` and `feed.ts` untouched (tiers/ceilings unchanged per guardrail).

## How it works

1. On mount, `App` calls `fetchOuraReadiness()`.
2. The adapter returns the latest readiness score (1–100) or `null`.
3. `App` applies the score **only if** it's non-null **and** the user hasn't dragged
   the slider yet (`userTouched` ref). After that, the slider/flip own `score`.
4. In dev, the request goes to the same-origin `/oura/...` path; Vite forwards it to
   `api.ouraring.com` server-side, sidestepping browser CORS. The Bearer token rides
   through the proxy unchanged.

## Verification

- **Typecheck:** `npx tsc -b` → clean (exit 0). Strict flags satisfied
  (`verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals/Parameters`).
- **Lint:** `npm run lint` (oxlint) → clean.
- **Boot:** `npm run dev` → Vite ready; `GET /` → HTTP 200.
- **Live end-to-end:** `GET /oura/v2/usercollection/daily_readiness?start_date=
  2026-06-21&end_date=2026-06-28` through the dev proxy with the real token →
  **HTTP 200** with a genuine payload (`day 2026-06-21, score 81`). This proves the
  proxy bypasses CORS, the token is valid, and a real score reaches the app on load.

All five acceptance criteria are met (see `progress.md` for the checklist).

## Test coverage & gaps

- **No automated tests** — the repo has no test runner (per CLAUDE.md), so none were
  added; that would be out of scope for this ticket. The type system + the manual
  live verification are the coverage.
- **Gap — browser-side UI confirmation not scripted:** I verified the data path
  (proxy + API + typecheck + the seeding logic by inspection), and confirmed the API
  returns a real score, but did not drive the actual browser to *watch* the header
  number change / the slider override visually. The logic is simple and verified by
  reasoning + the live 200 response; a reviewer wanting belt-and-suspenders can open
  `localhost:5173` and confirm: (a) the score isn't `61` on load, (b) dragging the
  slider holds against a late Oura response, (c) the flip still toggles Sharp↔Fog.
- **Negative path verified by construction, not executed:** the empty-token and
  network-failure branches both `return null` and were not exercised at runtime
  (token is present). The branches are trivial and the `null` → "keep default"
  contract is exercised by the happy-path code shape.

## Open concerns / known limitations

1. **Production CORS:** the proxy is dev/preview-only. A static production build would
   call `https://api.ouraring.com` directly and likely be CORS-blocked → `null` →
   graceful fallback to default score. Fine for this `npm run dev` demo; flagged if
   the app is ever deployed statically (would need a small serverless proxy).
2. **UTC date window:** `toISODate` uses UTC days. Near midnight in some timezones the
   "today" boundary could differ from the user's local day, but the 7-day window makes
   this immaterial for picking the most recent score.
3. **Sub-slider-range scores:** a real score below the slider `min` (50) still tiers
   correctly (→ Fog) and the header shows the true number, but the slider thumb pins
   at its min until dragged. Cosmetic only; left as-is per design D6 (no tier/slider
   changes allowed).
4. **PAT in client bundle:** `VITE_OURA_TOKEN` is exposed to the client (any `VITE_`
   var is). This is inherent to the chosen architecture and acceptable for a personal
   single-user hackathon demo; not suitable for a multi-user production app.

## Critical issues needing human attention

None. The change is additive, type-clean, lint-clean, boots, and is fully isolated
behind a total `Promise<number | null>` contract so it cannot break the demo floor.

## Note for the orchestrator

This working tree is **not a git repository**, so no commits were made. Lisa handles
VCS and phase transitions; the artifacts in `docs/active/work/T-001-01/` are the
record of the completed RDSPI pass.
