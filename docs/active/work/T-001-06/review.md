# T-001-06 · Review — polish-and-demo

Handoff document. Read this instead of the diff. What changed, how each acceptance
criterion is met, what's verified vs. left for a human, and the open concerns.

## Summary

Final hackathon polish for Inner Weather. The Sharp↔Fog flip now delivers its named wow in
full: shielded cards **un-blur in a staggered wave _and slide_** to their new position
(a real FLIP animation) instead of teleporting. A latent bug was found and fixed — the
diary strip's styles lived in an **orphaned `App.css` that was never imported**, so they
shipped in no bundle; they're now in `index.css` and load. The demo script is drafted into
the concept doc, deployment (with a mandatory secrets-off-client gate) is documented, and
the production build is proven green. The GIF is the one item a human must finish — the
automated browser tool wasn't available in this environment.

Everything is additive and demo-floor-safe: the curated HERO_FEED + slider + flip works
with zero API keys, and the one new piece of imperative code (the FLIP hook) is inert on
any failure.

## Files changed

| File | Action | Summary |
|------|--------|---------|
| `src/App.tsx` | **modified** | Added `useFlipReorder` hook (FLIP via native `el.animate`, `composite:"add"`, feature-detected + try/catch + reduced-motion guard). Each card gets `ref={register}` and inline `--i` visual index. |
| `src/index.css` | **modified** | Relocated the `.diary*` rules here (verbatim) so they load; added per-card stagger (`--i-delay`) + slower 700ms delayed un-blur; bumped shielded blur to `8px`/`saturate(.55)` for projector contrast; added a `prefers-reduced-motion` block. |
| `src/App.css` | **deleted** | Orphaned (never imported). Its only live rules (`.diary*`) were moved to `index.css`; the rest was dead Vite-starter CSS. |
| `../INNER_WEATHER_CONCEPT.md` | **modified** | Added `### ≤3-min demo script (judge walkthrough)` at the end of §1, reusing the pitch's Fog→Sharp wording. |
| `DEPLOY.md` | **created** | Build → host (Netlify / GitHub Pages) → **⚠ secrets off-client** → pre-deploy checklist. |
| `docs/active/work/T-001-06/gif-recording-recipe.md` | **created** | Exact steps to record `inner-weather-flip.gif` (Claude tool path + manual screen-record path), since the browser bridge was unavailable. |

No change to `tiers.ts` (ceilings 2/3/5 and thresholds untouched — guardrail honored),
`feed.ts`, `sources/*`, `lib/*`, `vite.config.ts`, or `package.json` (zero new deps — the
FLIP uses the native Web Animations API).

## How the new flip reads

On a Fog→Sharp flip three things now happen in concert over the morph:
1. `data-tier` swaps the token set → the whole page cross-fades (violet+rain → neon-lime
   razor, rain stops) over `--morph` (900ms).
2. The high-intensity cards lose `.shielded`; their blur/scale animate off over 700ms, now
   **staggered** by `--i-delay` (45ms × visual index) so the shields lift like a wave.
3. `useFlipReorder` measures each card's pre-flip vs post-flip rect and runs a WAAPI
   translate so the card **slides** from its old cell to its new one. `composite:"add"`
   layers that slide on top of the card's CSS `scale(.97)`, so nothing pops when it releases.

The result matches the concept's "the shielded cards **un-blur and rise** to the top."

## Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| Flip visibly smooth — cards un-blur **and reorder**, high-contrast on a projector | ✅ code / ⚠ visual | FLIP slide + staggered un-blur implemented; blur bumped to 8px and saturation dropped for projector legibility. Verified by tsc/lint/build/boot; **on-screen confirmation pending a human** (no browser bridge here). |
| One polished Fog state + one polished Sharp state on the hero set | ✅ | Hero set unchanged + diary strip now actually styled (was unstyled due to the orphaned CSS) + projector-tuned shield treatment. Both states render from the curated floor with zero keys. |
| `inner-weather-flip.gif` recorded | ⚠ **deferred to human** | Claude browser extension not connected (`tabs_context_mcp` failed). Precise recording recipe written to the work dir; this is the single human-completable AC. |
| ≤3-min demo script drafted in CONCEPT §1 | ✅ | `### ≤3-min demo script` appended to §1 with timed beats reusing §1's wording. |
| `npm run build` succeeds; deploy steps documented (secrets off-client) | ✅ | `npm run build` → exit 0. `DEPLOY.md` documents build + Netlify/GH Pages + the mandatory move of You.com/Oura keys behind a serverless function (proxies are dev-only; `VITE_*` vars are bundled). |
| `npx tsc -b` clean and dev server boots | ✅ | `tsc -b` → exit 0; `vite` ready ~106ms; `curl /` → HTTP 200. |

## Verification performed

- `npx tsc -b` → **exit 0**. Strict flags OK (type-only `CSSProperties` import for
  `verbatimModuleSyntax`; no unused locals; `--i` via `CSSProperties` cast).
- `npm run lint` (oxlint) → **exit 0**, no findings.
- `npm run build` → **exit 0**; `dist/` emitted (CSS 6.11 kB, JS 361 kB / 104 kB gz).
- `npm run dev` → ready ~106ms; `GET /` → **200**.
- Orphan-fix proof: `grep -c diary-chip dist/assets/*.css` → **1** (diary styles now ship;
  pre-ticket they shipped in no bundle). The `crypto` externalized notice during build is a
  pre-existing `@insforge/sdk` browser-compat warning, not introduced here.
- **No automated tests** exist (CLAUDE.md: "no test runner"); verification is tsc + lint +
  build + boot per house policy.

## Test-coverage gaps (honest)

- **No visual/interaction test of the flip.** There's no DOM/visual-regression harness, and
  the browser extension wasn't connected, so the un-blur+slide was confirmed only by code
  inspection + the safety design, not by watching it. A human should run `npm run dev`, flip
  both ways, and confirm the cascade + slide read well (and record the GIF while there).
- **FLIP relies on browser support for WAAPI `composite:"add"`.** Modern Chromium/Firefox/
  Safari support it; the code feature-detects `el.animate` but not `composite` specifically.
  Worst case if `composite` were ignored: the slide briefly drops the `scale(.97)` — a minor
  cosmetic nuance, not a break. Demo machine is Chrome, where it's fully supported.
- **React StrictMode double-invokes `useLayoutEffect`** in dev; the hook is idempotent (first
  pass has no prior positions → bails and records them), so no double-animation. Noted for
  the next reader.

## Open concerns / handoff

1. **Record `inner-weather-flip.gif`** — the only unfinished AC. Follow
   `docs/active/work/T-001-06/gif-recording-recipe.md`; drop the file at the repo root.
2. **Do not public-deploy with `VITE_YOU_API_KEY` / `VITE_OURA_TOKEN` set** — they inline
   into the bundle and the dev proxies don't exist in a static build. `DEPLOY.md` §3 is the
   gate; move both behind a serverless function first. The InsForge anon key may stay
   (RLS-protected); the admin `INSFORGE_API_KEY` must never ship.
3. **No git** in this repo, so there are no commits to review — the diff is the working
   tree against the pre-ticket state described above.
4. **Quick taste pass suggested:** glance at the stagger timing (45ms/card) and the 520ms
   FLIP duration on the real projector; both are easy one-line tweaks in `index.css` /
   `App.tsx` if the wave feels too fast or slow on stage.
