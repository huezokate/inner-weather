# T-001-05 — Design: InsForge AI Intensity Classifier

Decisions, with rationale, grounded in research.md. One new file `src/lib/classify.ts` and a
small edit to `fetchLiveFeed()` in `src/feed.ts`.

## Decision 1 — Which AI access path

The SDK docs offer two paths. We pick the **InsForge SDK gateway** (`client.ai.chat.completions
.create`), not the "direct OpenRouter" path.

| Option | How | Verdict |
|---|---|---|
| **A. SDK AI gateway** | `createClient({baseUrl, anonKey}).ai.chat.completions.create(...)` | **Chosen** |
| B. Direct OpenRouter | `new OpenAI({ apiKey: OPENROUTER_API_KEY })` from the browser | Rejected |
| C. Backend function | InsForge edge function proxies the model call | Rejected (overkill) |

- **B is rejected on security**: the SDK docs explicitly warn never to expose
  `OPENROUTER_API_KEY` in a browser bundle. This is a client-only Vite app; any key we put in
  `VITE_*` ships to users. Path B is unsafe here. It also needs a new `openai` dependency.
- **C is rejected on scope/time**: a backend function is the "production" answer but the backend
  has zero functions provisioned (research.md), and a hackathon demo doesn't need it. The
  acceptance criteria only require client-side scoring with a clean fallback.
- **A is chosen**: it reuses the exact pattern already proven in `insforge.ts` (anon-key client,
  configured-gate, error isolation). The anon key is *designed* to be public; the OpenRouter key
  stays server-side on InsForge. The docs call this path "deprecated" but confirm it still works
  via compatibility proxy routes — acceptable for a demo, and it's the only browser-safe option
  that needs no new dependency. We isolate it behind one function so swapping to a backend
  function later is a one-file change.

## Decision 2 — Batch vs per-item calls

**One batched call** for the whole live set (≤20 items, research.md). Send all titles in a
single prompt; ask for a JSON array `[{id,intensity}]` back.

- Rejected per-item fan-out: 20 round-trips, 20× latency and cost, 20× failure surface, and it
  delays the feed render. The flip demo wants the feed to settle fast.
- Batching means one try/catch, one fallback decision, one `console.warn` on skip.

## Decision 3 — Prompt & response contract

System message pins the rubric to the app's own scale (`feed.ts:9-12`):

```
1 soothing · 2 calm · 3 neutral · 4 activating · 5 agitating
```

User message is a JSON array of `{id, title}` for the live items, with an instruction:
"Rate each item 1–5 for how activating/agitating it is. Return ONLY a JSON array
`[{\"id\":\"...\",\"intensity\":N}]`, no prose." We pass the **id** so scores map back
unambiguously regardless of order or omissions. We also request a low `temperature` (0) for
determinism so the demo behaves the same on every run, if the gateway honors it.

Why id round-trip over positional array: the model may reorder, merge, or drop entries. Keying
by id makes parsing order-independent and lets us cleanly ignore hallucinated/unknown ids.

## Decision 4 — Defensive parsing & clamping

The response is `Promise<any>` and the content is model-generated text — treat both as hostile.
Pipeline:

1. Read `completion?.choices?.[0]?.message?.content`; if not a non-empty string → skip (return
   originals).
2. **Strip markdown fences**: models often wrap JSON in ` ```json … ``` `. Extract the first
   `[ … ]` substring before `JSON.parse`.
3. `JSON.parse` in try/catch; require an array.
4. Build a `Map<string, number>` from valid entries only: `id` must be a string, `intensity`
   coerced via `Number(...)`, then **`Math.round` and clamp to `[1,5]`**; drop NaN.
5. Overwrite: for each live item, `intensity = scores.get(item.id) ?? item.intensity`. Unknown
   or unscored items keep their source prior. HERO_FEED items are never passed in, so they can't
   be touched.

This guarantees the invariant from research.md: every resulting `intensity` is an integer 1–5.

## Decision 5 — Model choice

Default `openai/gpt-4o-mini`: cheap, fast, reliably available on OpenRouter, strong at terse
JSON — ideal for a 20-item rating task. The project guardrails favor latest Claude models, but
model availability depends on what's configured on *this* gateway, which we can't verify. A
small classifier model is the right tool regardless of family, so we keep it as a single
named constant `CLASSIFY_MODEL` that's trivial to change to `anthropic/claude-3.5-haiku`. Model
choice does not affect correctness — only flavor of the score.

## Decision 6 — Configuration gate & client ownership

`classify.ts` reads `VITE_INSFORGE_BASE_URL` / `VITE_INSFORGE_ANON_KEY` and creates its **own**
client once, mirroring `insforge.ts`. Rationale: each adapter in this codebase independently
reads its own env (reddit, youcom, oura, insforge) — self-containment is the house idiom, and it
keeps `insforge.ts` (which is serialized behind T-001-04) untouched. The tiny cost is a second
`createClient`; acceptable. `classifyConfigured = Boolean(baseUrl && anonKey)`; when false we
short-circuit and return items unchanged with an `console.info` note — exactly the "missing
keys → keep priors, note the skip" criterion.

## Decision 7 — Integration point

`classifyIntensity(items)` is called inside `fetchLiveFeed()` (`feed.ts:69-81`), after
`dedupe(...).slice(0,20)` and before returning. It is itself **total** (never throws): its own
try/catch returns the input array on any failure. So `fetchLiveFeed`'s existing outer try/catch
remains a belt-and-suspenders backstop, and `App.tsx` is unchanged.

```
const live = dedupe([...you, ...reddit]).slice(0, 20);
return classifyIntensity(live);   // refines in place; returns live unchanged on any failure
```

## What we explicitly do NOT do

- Do not classify HERO_FEED — it's hand-tagged and must stay stable for the flip.
- Do not add an `openai` dependency or any `VITE_OPENROUTER_*` env (would leak a key).
- Do not change tiers, ceilings, the sort, or the shield.
- Do not block or slow the first render on classification beyond the single batched call already
  inside the awaited chain (the feed only needs `fetchLiveFeed` to resolve once).
