# T-001-06 · Design — polish-and-demo

Decisions for the final polish, each grounded in the research. The north star: make the
flip read as "cards un-blur **and rise**" on a projector, without ever risking the demo
floor. Every change is additive and degrades to today's working behavior on failure.

## Decision 1 — Reorder animation: defensive FLIP via Web Animations API

**Problem (from Research).** Cards un-blur in place but *teleport* on reorder; CSS grid
order changes are not transitionable, so the concept's "rise to the top" is unrealized.

**Options considered**

- **A. Do nothing / only tune timing.** Lowest risk. But the single most-quoted line of
  the concept ("un-blur and **rise**") stays unfulfilled — the wow is half-delivered.
- **B. Animation library (Framer Motion / `react-flip-toolkit`).** Turn-key layout
  animations. Rejected: a new dependency for one screen, bundle weight, and it owns the
  render of the feed — more surface area to break the demo floor. Overkill.
- **C. Hand-rolled FLIP with the native `element.animate()` (WAAPI).** First-Last-Invert-
  Play: in a `useLayoutEffect`, read each card's previous rect, compare to the new rect,
  set an inverting transform, then animate it to identity. Zero dependencies, ~30 lines,
  and — critically — purely **on top of** normal rendering: if it throws or is
  unsupported, the cards still render and reorder exactly as today.

**Chosen: C.** It directly delivers the named wow with no dependency and a clean fallback.
Safety details that make it demo-floor-safe:
- Feature-detect `typeof el.animate === "function"`; if absent, no-op.
- Wrap measure + animate in `try/catch`; any throw → cards just reorder instantly (today's
  behavior). The animation is decorative, never load-bearing.
- Use `composite: "add"` so the FLIP translate is **added** to the card's existing CSS
  `transform` (`scale(0.97)` while shielded). This preserves the scale/un-blur the CSS
  transition is already doing — no pop when WAAPI releases at animation end.
- Drive it off a `useLayoutEffect` keyed on the rendered id-order string, measuring against
  a `Map<id, DOMRect>` ref captured on the previous commit. Standard, well-understood FLIP.
- Respect `prefers-reduced-motion: reduce` → skip the slide (un-blur still happens).

**Why not animate layout in React state.** Position must be measured from the real DOM
post-layout; that's exactly what `useLayoutEffect` + `getBoundingClientRect` is for. No
state churn, no extra renders.

## Decision 2 — Staggered un-blur cascade

**Goal.** On a projector, a simultaneous un-blur of six cards is a single flat event. A
short per-card stagger makes the shields lift like a **wave** — far more legible and
dramatic on stage, and it visually pairs with the FLIP slide.

**Approach.** Pass each card its visual index as an inline CSS var `--i={index}` and add
`transition-delay: calc(var(--i) * 45ms)` to the card's `filter`/`transform` transition.
Pure CSS, additive, no JS. Cap the cascade so the last card isn't perceptibly late
(6 hero cards visible under the Sharp ceiling → ~225ms tail, well within the 900ms morph).

**Rejected:** JS-timed `setTimeout` staggering — needless complexity and a re-render
source; CSS `transition-delay` is declarative and free.

## Decision 3 — Timing + contrast tune for the projector

Research shows the morph is 900ms and the card filter/transform is 600ms. For a projector:
- Keep `--morph` at 900ms (the page cross-fade feels right; longer drags, shorter snaps).
- Nudge the **un-blur** transitions to `700ms ease` so the lift reads a touch slower and
  the stagger has room — still finishes within the page morph.
- Increase the shielded blur from `blur(7px)` to `blur(8px)` and drop saturate to `0.55`
  so "shielded" is unmistakable on a low-contrast projector, making the un-blur a bigger
  visual delta. (Cosmetic; ceilings/logic untouched — guardrail honored.)

These are small, reversible CSS tweaks. No threshold or tier change.

## Decision 4 — Fix the orphaned CSS, fold diary styles into `index.css`

**Problem (from Research).** `App.css` is never imported, so its `.diary*` rules don't load
(diary strip renders unstyled) and its Vite-starter selectors are dead weight.

**Options**

- **A. Add `import "./App.css"` to App.tsx.** One line, but it also loads ~160 lines of
  dead starter CSS and keeps two stylesheets for one screen.
- **B. Move the `.diary*` rules into `index.css` (already loaded) and delete `App.css`.**
  Fixes the diary styling, deletes the dead template CSS, leaves one stylesheet. Slightly
  more churn but strictly better end state.

**Chosen: B.** It both fixes a real visual bug *and* cleans up — exactly what a polish
ticket is for. Low risk: the moved rules are copied verbatim; deleting an unreferenced file
cannot change rendering except to *add* the diary styles that were missing.

## Decision 5 — GIF recording: attempt live, document a fallback

The AC requires `inner-weather-flip.gif` via the `gif_creator` browser tool. That needs a
running dev server in a Chrome tab with the extension connected — an environmental
dependency that may be absent in an automated run (Research). Plan: boot the dev server,
attempt to drive Chrome and capture the flip both ways into `inner-weather-flip.gif`. If
the browser bridge is unavailable, **do not fail the ticket** — write a precise,
copy-pasteable recording recipe (exact URL, the two clicks, frame-capture cadence, output
name/path) into the work dir and the review, and flag the GIF as the one human-completable
item. The wow itself is verifiable live regardless.

## Decision 6 — Demo script: add to CONCEPT §1, don't rewrite the pitch

CONCEPT §1 is "The pitch (what a judge sees in 30 seconds)" — strong, keep it. Append a
`### ≤3-min demo script` subsection **within §1** (the ticket says "§1 wording"), reusing
the existing Fog→Sharp narrative beats verbatim so stage language matches the doc. A timed,
spoken walkthrough: open in Fog, name the readiness, point at a shielded card, tap the flip,
land the "same feed, your nervous system decides" line, then the InsForge diary/AI proof
beats. No change to the rest of the concept.

## Decision 7 — Deploy: document, do not execute

The AC says deploy steps **documented**, with secrets moved off-client before any public
deploy — not that we publish today. Deploying is outward-facing and needs credentials we
shouldn't assume. Decision: write `DEPLOY.md` at the repo root covering (a) `npm run build`
→ `dist/`, (b) Netlify / GitHub Pages static hosting to match Kate's other projects, and
(c) the **mandatory** secrets step — the `vite.config.ts` dev proxies vanish in a static
build, and `VITE_YOU_API_KEY` / `VITE_OURA_TOKEN` would ship in the bundle, so both must
move behind a serverless function (the InsForge anon key stays client-side, protected by
RLS). Documenting beats a half-done deploy that leaks keys. We will run `npm run build`
locally to prove it compiles (an explicit AC) but not publish.

## What stays untouched

`tiers.ts` (ceilings/thresholds), `feed.ts` data + `applyShield` semantics, the live
sources, `lib/insforge.ts`, `lib/classify.ts`. The only `feed.ts` edit considered is
exposing the visual index to the card (handled in `App.tsx` at render — `feed.ts` likely
needs **no** change; confirmed in Structure). Net code edits land in `App.tsx` + CSS;
docs land in CONCEPT + DEPLOY + the work dir.

## Risk ledger

| Change | Risk | Mitigation |
|---|---|---|
| FLIP slide | could throw / jank | feature-detect + try/catch + reduced-motion → instant reorder fallback |
| Stagger | last card late | 45ms × ≤6, capped under the 900ms morph |
| Blur/timing tune | taste regression | tiny, reversible; logic untouched |
| Delete App.css | lose a needed rule | rules moved verbatim first; file is unreferenced |
| GIF tool absent | AC blocked | documented manual recipe + flagged in review |
| Deploy | key leak | document-only; secrets-off-client called out as mandatory |
