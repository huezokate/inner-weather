# T-001-06 · Plan — polish-and-demo

Ordered, independently-verifiable steps. No git in this repo (Research), so "commit" is
replaced by "verify gate"; `progress.md` is the durable record of each step. Verification
is `npx tsc -b` clean + `npm run lint` clean + dev boots (house policy — no test runner).

## Step 1 — Relocate diary CSS into `index.css`

- Append a commented "weather diary strip" block to `src/index.css` containing the `.diary`,
  `.diary-label`, `.diary-track` (+ `::-webkit-scrollbar`), `.diary-chip`, and the three
  `.diary-chip[data-tier="FOG|PERSEVERANCE|SHARP"]` rules, copied **verbatim** from
  `App.css`.
- **Verify:** `npx tsc -b` clean (CSS doesn't typecheck, but ensures nothing else broke);
  visually, diary chips will now be styled once the strip has entries.

## Step 2 — Delete the orphaned `App.css`

- Remove `src/App.css` (unreferenced; diary rules now live in `index.css`).
- **Verify:** `grep -rn "App.css" src` returns nothing; `npx tsc -b` clean; dev boots.

## Step 3 — Add stagger + reduced-motion + projector tune to `index.css`

- On `.card`: add `--i-delay: calc(var(--i, 0) * 45ms);` and change the transition to
  `transition: all var(--morph), filter 700ms ease var(--i-delay), transform 700ms ease
  var(--i-delay);`.
- Change `.card.shielded` filter to `blur(8px) saturate(0.55)`.
- Add `@media (prefers-reduced-motion: reduce)` block zeroing card transition duration and
  the rain animation.
- **Verify:** dev boots; toggling the slider shows a staggered un-blur cascade; no console
  errors.

## Step 4 — Add the FLIP reorder hook + wiring in `App.tsx`

- Add module-scoped `useFlipReorder(orderKey)` per Structure: `positions`/`nodes` refs, a
  `register(el, id)` ref callback, a `useLayoutEffect([orderKey])` that measures rects and
  runs `el.animate(..., {composite:"add"})` for moved cards. Feature-detect `el.animate`;
  wrap in try/catch; bail on `prefers-reduced-motion`.
- In `App`: derive `orderKey = items.map(i => i.id).join(",")`; `const register =
  useFlipReorder(orderKey)`; on each `<article>` add `ref={(el)=>register(el, it.id)}` and
  `style={{ "--i": idx } as React.CSSProperties}` (idx from the `map`).
- **Verify:** `npx tsc -b` clean (watch `verbatimModuleSyntax`, `noUnusedLocals`, the
  `--i` CSSProperties cast); `npm run lint` clean.

## Step 5 — Manual flip QA (the wow)

- Boot dev; flip Fog→Sharp and Sharp→Fog via the button and via slider drag.
- Confirm: shielded cards un-blur, the cascade reads, and cards **slide** to their new
  position (FLIP) instead of teleporting. Confirm fallback path by forcing reduced-motion
  (cards reorder instantly, still un-blur).
- **Verify:** no console errors; HERO_FEED-only path (no live keys needed) looks right.

## Step 6 — Demo script into CONCEPT §1

- Append `### ≤3-min demo script (judge walkthrough)` at the end of §1 of
  `../INNER_WEATHER_CONCEPT.md`, before the §2 `---`. Timed beats reuse §1's Fog→Sharp
  language verbatim.
- **Verify:** §1 still opens with the existing pitch; new subsection is the last thing in
  §1; markdown renders.

## Step 7 — `DEPLOY.md`

- Create repo-root `DEPLOY.md` per Structure: Build → Host (Netlify / GitHub Pages) →
  **⚠ Secrets before public deploy** (proxies are dev-only; move You.com + Oura to a
  serverless function; anon key OK; admin key never ships) → Checklist.
- **Verify:** file exists; the secrets gate is unambiguous.

## Step 8 — GIF capture (best-effort)

- Boot dev server (`npm run dev`, background). Attempt the `gif_creator` browser flow:
  open `localhost:5173`, capture pre-flip frames in Fog, click "What if I were Sharp?",
  capture the morph, click back to Fog, capture; save as `inner-weather-flip.gif` at repo
  root. Capture extra leading/trailing frames for smooth playback (browser-tool guidance).
- **Fallback:** if the browser bridge/extension is unavailable, write
  `docs/active/work/T-001-06/gif-recording-recipe.md` with exact steps and name the GIF as
  the single human-completable AC in the review. Do **not** fail the ticket.
- **Verify:** either `inner-weather-flip.gif` exists, or the recipe doc + review flag exist.

## Step 9 — Production build gate (AC) + final verification

- `npm run build` → must succeed (`tsc -b && vite build`). Grep `dist/` to confirm the
  secrets posture is understood (You.com/Oura keys *are* inlined in a plain build — that's
  exactly why DEPLOY.md gates a public deploy).
- Final gate: `npx tsc -b` clean, `npm run lint` clean, `npm run dev` boots (HTTP 200).
- **Verify:** record all command outputs in `progress.md`.

## Step 10 — Review

- Write `review.md`: files changed, how each AC is met (with evidence), test-coverage note
  (no runner — tsc/lint/boot), and open concerns (GIF status, deploy-not-executed, FLIP
  browser-support caveat).

## Testing strategy

- **No unit/integration tests** exist or are added (CLAUDE.md: no test runner). Each step's
  gate is typecheck + lint + boot, plus manual flip QA for the visual steps (5).
- **Regression guard:** the demo floor (HERO_FEED + slider + flip) is exercised in Step 5
  with zero live keys, proving the curated path is intact independent of any live source.
- **Failure-path check:** reduced-motion (Step 5) proves the FLIP degrades to instant
  reorder — the demo-floor guarantee for the one new piece of imperative code.

## Rollback

Each step is isolated. The FLIP hook (Step 4) is the only behavioral code; reverting it
returns to today's instant reorder. CSS steps are cosmetic/additive. Docs + GIF are
non-code. Nothing here can wedge the build that a single-file revert can't undo.

## Done when

All six ACs: smooth un-blur+reorder flip ✓ (Steps 3–5), polished Fog & Sharp on hero set ✓
(Steps 1–3,5), GIF recorded or recipe'd ✓ (Step 8), demo script in §1 ✓ (Step 6), build
succeeds + deploy documented ✓ (Steps 7,9), tsc clean + dev boots ✓ (Step 9).
