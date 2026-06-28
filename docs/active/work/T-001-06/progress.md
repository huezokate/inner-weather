# T-001-06 · Progress — polish-and-demo

Durable record of the Implement phase. No git in this repo, so this file (not commits) is
the trail. All steps from `plan.md` executed in order.

## Step log

| # | Step | Status | Notes |
|---|------|--------|-------|
| 1 | Relocate diary CSS → `index.css` | ✅ | `.diary*` block appended verbatim, commented. |
| 2 | Delete orphaned `App.css` | ✅ | Removed; only `src/index.css` remains. The lone remaining "App.css" string is my comment, not an import. |
| 3 | Stagger + reduced-motion + projector tune | ✅ | `--i-delay` + 700ms delayed un-blur; `blur(8px) saturate(0.55)`; `prefers-reduced-motion` block. |
| 4 | FLIP reorder hook + wiring (`App.tsx`) | ✅ | `useFlipReorder`; `ref`+`--i` on each `<article>`; `orderKey` from item ids. |
| 5 | Manual flip QA | ⚠️ partial | Could not drive the browser (extension not connected). Verified structurally: tsc/lint clean, dev boots 200, FLIP is feature-detected + try/catch + reduced-motion guarded so the worst case is today's instant reorder. |
| 6 | Demo script → CONCEPT §1 | ✅ | `### ≤3-min demo script` appended at end of §1, before §2's `---`. |
| 7 | `DEPLOY.md` | ✅ | Build → host (Netlify/GH Pages) → ⚠ secrets-off-client → checklist. |
| 8 | GIF capture | ⚠️ deferred | Browser extension not connected → `tabs_context_mcp` failed. Wrote `gif-recording-recipe.md` (tool path + manual path). `inner-weather-flip.gif` is the one human-completable AC. |
| 9 | Production build gate | ✅ | `npm run build` exit 0; bundle emitted. |
| 10 | Review | ✅ | `review.md`. |

## Verification (commands + outcomes)

- `npx tsc -b` → **exit 0** (clean). Strict flags satisfied: `verbatimModuleSyntax`
  (type-only `CSSProperties` import), `noUnusedLocals/Parameters`, `erasableSyntaxOnly`.
- `npm run lint` (oxlint) → **exit 0** (no findings).
- `npm run build` (`tsc -b && vite build`) → **exit 0**. Output: `dist/assets/
  index-*.css 6.11 kB`, `index-*.js 361.32 kB` (gzip 103.96 kB). The `crypto` externalized
  warning is from `@insforge/sdk` and is pre-existing/benign for a browser build.
- `npm run dev` → Vite ready ~106ms; `curl localhost:5173/` → **HTTP 200**.
- Orphan-fix proof: `grep -c diary-chip dist/assets/*.css` → **1** (diary styles now ship;
  before this ticket they were in the never-imported App.css and shipped in **no** bundle).

## Deviations from plan

- **Step 5/8 (manual QA + GIF):** the environment has no connected Claude browser
  extension (`tabs_context_mcp` → "Browser extension is not connected"), so I could neither
  click through the flip nor record the GIF. This was anticipated in design.md (Decision 5)
  and plan.md (Step 8 fallback). Mitigation: the new imperative code (the FLIP hook) is
  written to be inert on any failure, and a complete recording recipe is in the work dir.
  No code path was left unverified by tsc/lint/build; only the *visual* confirmation and the
  GIF artifact remain for a human.
- **No commit** (Step gates): repo is not a git repository (`git rev-parse` fails). Honored
  by treating each step's tsc/lint/boot as the gate and logging here instead.

## Files touched

- `src/App.tsx` — modified (FLIP hook + card ref/`--i`).
- `src/index.css` — modified (diary block relocated; stagger; reduced-motion; blur tune).
- `src/App.css` — deleted (orphaned).
- `../INNER_WEATHER_CONCEPT.md` — modified (§1 demo script).
- `DEPLOY.md` — created.
- `docs/active/work/T-001-06/gif-recording-recipe.md` — created (GIF fallback).
