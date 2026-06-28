# T-001-01 · Design — live-oura-readiness

Decisions, grounded in `research.md`. Each section states options, tradeoffs, and the
choice with rationale.

## D1 — Where the Oura fetch lives

**Options**
- (a) Inline `fetch` inside an `App.tsx` effect.
- (b) A dedicated `src/sources/oura.ts` adapter exporting `fetchOuraReadiness()`,
  called from an `App.tsx` effect.

**Choice: (b).** The ticket and CLAUDE.md both prescribe `src/sources/oura.ts`, and
it mirrors the established `fetchLiveFeed()` boundary in `feed.ts` (async source,
self-contained, failure swallowed). Keeps `App.tsx` declarative and makes the
adapter independently testable/replaceable. Rejected (a): inlining couples network
detail to the view and breaks the source-adapter convention the repo is building
toward.

## D2 — Adapter contract / return type

**Options**
- (a) Return `number | null` (just the score).
- (b) Return a richer `{ score, day } | null`.

**Choice: (a) `Promise<number | null>`.** `App` only needs a number to seed `score`.
`null` is the universal "no usable data — fall back" signal (token missing, network
error, empty data, null score, non-OK status). This matches the ticket's "return
`null` on any failure" and keeps the call site trivial: `if (s != null) setScore(s)`.
Rejected (b): YAGNI — nothing consumes `day` yet; can widen later without breaking
callers if needed.

## D3 — CORS: direct fetch vs. dev proxy

**Options**
- (a) Direct `fetch('https://api.ouraring.com/...')`, accept it may be CORS-blocked.
- (b) Add a Vite `server.proxy` for `/oura` and always call the same-origin path.
- (c) Try direct, document proxy as a fallback to flip on if blocked.

**Choice: (b) — add the proxy up front and call `/oura/v2/...`.** Research found
`api.ouraring.com` is not CORS-enabled for browser origins, so a direct call from
`localhost:5173` will almost certainly fail. Doing the proxy now avoids a guaranteed
debugging detour and is exactly what the ticket pre-authorizes. The adapter calls a
**relative** path (`/oura/v2/usercollection/daily_readiness`), which is same-origin
in dev and lets Vite forward the request server-side (no browser CORS). Cost: the
proxy is dev/preview-only — a production static build would still hit CORS, but this
is a `npm run dev` hackathon demo, so acceptable and documented. Rejected (a):
predictable failure. Rejected (c): wastes the demo's time on a known outcome.

### Proxy detail
`vite.config.ts` → `server.proxy['/oura'] = { target: 'https://api.ouraring.com',
changeOrigin: true, rewrite: p => p.replace(/^\/oura/, '') }`. `changeOrigin` makes
Oura see its own host in the `Host` header. The `Authorization` header is set by the
adapter and passes through the proxy unchanged.

## D4 — Override semantics (slider must still win after Oura lands)

This is the subtle one. The Oura fetch is async and may resolve *after* first paint
and possibly *after* the user has already dragged the slider.

**Options**
- (a) Always `setScore(ouraScore)` when it arrives. Risk: if the user dragged the
  slider during the ~loading window, Oura would clobber their input — violating
  "slider still overrides."
- (b) Seed only if the user hasn't touched the slider yet — track a `userTouched`
  flag; apply Oura only when `!userTouched`.
- (c) Apply Oura unconditionally on mount but accept the tiny race.

**Choice: (b).** "The manual slider still overrides the score after load" is an
explicit acceptance criterion. A `userTouched` ref/flag set on the slider's
`onChange` makes the rule precise and order-independent: Oura seeds the initial
state; the moment the user interacts, their value is authoritative and a late Oura
response is ignored. Implementation: a `useRef(false)` (no re-render needed) flipped
in the slider handler; the Oura effect checks `if (!touched.current && s != null)`.
Rejected (a): fails the criterion under a realistic race. Rejected (c): same risk,
just less likely — not worth the ambiguity in a demo that will be poked live.

Note the `flipToSharp` button also calls `setScore`. It is a deliberate demo
control; we do **not** count it as a "user touched the slider" lock — leaving the
flip independent keeps the wow-button behaving identically regardless of Oura. Since
Oura only writes once on mount (and only if untouched), there's no ongoing conflict
with the flip button.

## D5 — Date window: today-only vs. small look-back

**Options**
- (a) `start_date = end_date = today`.
- (b) `start_date = today − N days`, `end_date = today`, take the most recent entry
  with a non-null score.

**Choice: (b) with N = 7, take the last element's score.** Research noted that
querying only `today` can legitimately return `[]` early in the day before the ring
syncs / the morning is processed — which would make the "real score on load"
criterion flaky depending on demo timing. A 7-day window virtually guarantees at
least one readiness record, and Oura returns `data` in ascending day order, so the
**last** entry is the most recent. We still defensively scan from the end for the
first non-null `score`. Minor cost: the displayed score may be yesterday's if today
isn't computed yet — acceptable and arguably more "real" than no data. The ticket
literally says "take the latest `.data[].score`," which (b) honors precisely.

## D6 — Out-of-slider-range scores (e.g. a real score < 50)

**Options**
- (a) Leave as-is — `tierForScore` already maps anything <70 to Fog, so tiering is
  correct even at 42; only the slider thumb would be pinned/clamped at its min.
- (b) Widen the slider `min` to accommodate.
- (c) Clamp the Oura score into the slider range before `setScore`.

**Choice: (a) — do nothing to the slider/tiers.** Guardrails forbid changing tiers,
and the slider range is a demo affordance, not a correctness boundary. A sub-50 real
score still resolves to Fog (correct), and the header shows the true number. If the
score is below the slider's `min`, the native range input simply renders the thumb at
min while `score` state holds the real value — display stays truthful. Widening or
clamping adds scope for no demo benefit. Documented as a known minor cosmetic edge.

## D7 — Empty-token handling

Per guardrail: if `VITE_OURA_TOKEN` is empty/absent, **skip the fetch entirely**.
The adapter checks the token first and returns `null` immediately (no network call,
no console noise), so the slider remains the sole source. The App call site treats
`null` identically to a failure → no `setScore`, default `61` stands. We log a single
concise `console.info` noting Oura was skipped/failed so the run summary can mention
it, without throwing.

## D8 — Failure logging

Wrap the whole adapter body in try/catch. On any throw, log at `console.warn`
(non-fatal) and return `null`. Because of `noUnusedParameters`/strict catch, we
either use the caught error in the log or use an optional catch binding. We'll log
the error so it's diagnosable but never rethrow. The demo floor is untouched because
`score` simply keeps its default.

## Summary of decisions

| # | Decision |
|---|----------|
| D1 | New adapter `src/sources/oura.ts`, called from an App effect |
| D2 | `fetchOuraReadiness(): Promise<number \| null>` |
| D3 | Add Vite dev proxy `/oura` → `api.ouraring.com`; adapter calls relative path |
| D4 | `userTouched` ref gate so the slider always wins post-load |
| D5 | 7-day window, take most recent non-null score |
| D6 | No slider/tier changes; sub-range scores tier correctly, display stays truthful |
| D7 | Empty token → return null immediately, no fetch |
| D8 | try/catch → warn + return null; demo floor never breaks |
