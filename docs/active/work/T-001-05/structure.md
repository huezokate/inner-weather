# T-001-05 — Structure: file-level blueprint

Two files touched. One created, one edited. No deletions. No new dependencies.

## Created: `src/lib/classify.ts`

The intensity classifier. Self-contained InsForge AI gateway adapter, total (never throws).

### Imports
```ts
import { createClient } from "@insforge/sdk";
import type { FeedItem } from "../feed";
```

### Module constants (top of file)
- `baseUrl = import.meta.env.VITE_INSFORGE_BASE_URL as string | undefined`
- `anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY as string | undefined`
- `export const classifyConfigured = Boolean(baseUrl && anonKey)`
- `const client = classifyConfigured ? createClient({ baseUrl, anonKey }) : null`
- `const CLASSIFY_MODEL = "openai/gpt-4o-mini"` — single point to swap models.
- `const SYSTEM_PROMPT` — the 1–5 rubric, mirrors `feed.ts` doc comment.

### Internal types
```ts
interface Scored { id: string; intensity: number }   // shape we coax out of the model
```

### Internal helpers (not exported)
- `buildUserPrompt(items: FeedItem[]): string`
  Serializes `items.map(i => ({ id: i.id, title: i.title }))` to JSON plus the
  "rate 1–5 … return ONLY a JSON array" instruction.
- `extractJsonArray(text: string): string | null`
  Strips markdown fences; returns the first `[ … ]` substring or `null`.
- `parseScores(content: unknown): Map<string, number>`
  `content` → string guard → `extractJsonArray` → `JSON.parse` (try/catch) → array guard →
  for each entry: `id` string + `Math.round(Number(intensity))` clamped to `[1,5]`, NaN
  dropped → `Map<id, intensity>`. Returns an empty Map on any problem (never throws).
- `clampIntensity(n: number): number` → `Math.min(5, Math.max(1, Math.round(n)))`.

### Public function
```ts
export async function classifyIntensity(items: FeedItem[]): Promise<FeedItem[]>
```
Behavior (the whole body is wrapped so it is total):
1. If `!client` or `items.length === 0` → `console.info(...)` (only when unconfigured) and
   `return items` unchanged.
2. `try`:
   - `const completion = await client.ai.chat.completions.create({ model: CLASSIFY_MODEL,
     temperature: 0, messages: [ {role:"system",content:SYSTEM_PROMPT},
     {role:"user",content: buildUserPrompt(items)} ] })`
   - `const scores = parseScores(completion?.choices?.[0]?.message?.content)`
   - If `scores.size === 0` → `console.warn("classify: no usable scores, keeping priors")` and
     `return items`.
   - `return items.map(it => scores.has(it.id) ? { ...it, intensity: scores.get(it.id)! } : it)`
3. `catch (err)` → `console.warn("classify: gateway call failed, keeping priors", err)` →
   `return items`.

### Public interface (exports)
- `classifyConfigured: boolean`
- `classifyIntensity(items: FeedItem[]): Promise<FeedItem[]>`

### Invariants this file guarantees
- Never throws (caller safety).
- Output array length === input length; ids and all other fields preserved; only `intensity`
  of matched live items changes.
- Every returned `intensity` is an integer in `1..5`.
- No network call when unconfigured (`client === null`).

## Modified: `src/feed.ts`

Minimal surgical edit; no signature changes to public exports.

1. **Add import** near the existing source imports (top of file):
   ```ts
   import { classifyIntensity } from "./lib/classify";
   ```
2. **Replace the `TODO(loop)` comment block** (`feed.ts:53-54`) with a one-line note that the
   classifier is now wired (keep the file's documentary style).
3. **Edit `fetchLiveFeed()`** (`feed.ts:69-81`): capture the deduped/capped list, pass it
   through `classifyIntensity`, return that.
   ```ts
   const live = dedupe([...you, ...reddit]).slice(0, 20);
   return classifyIntensity(live); // refine live intensities; returns live unchanged on failure
   ```
   The surrounding `try/catch` stays as the outer backstop.

No change to `FeedItem`, `HERO_FEED`, `REDDIT_LANES`, `dedupe`, or `applyShield`.

## Untouched (explicitly)
- `src/App.tsx` — consumes `fetchLiveFeed()` as-is; the refined intensities flow through the
  existing sort (`App.tsx:50-54`) and shield (`App.tsx:55`) with no code change.
- `src/tiers.ts`, `src/sources/*`, `src/lib/insforge.ts` — no edits.
- `package.json` — no new dependency.
- `.env.local` — no new keys; reuses `VITE_INSFORGE_BASE_URL` / `VITE_INSFORGE_ANON_KEY`.

## Ordering of changes
1. Write `classify.ts` in full (compiles standalone — only depends on the `FeedItem` type and
   the already-installed SDK).
2. Edit `feed.ts` to import and call it.
3. `npx tsc -b` → must be clean. Then boot `npm run dev`.

Reason for this order: `classify.ts` has no dependency on the `feed.ts` edit, so it can be
typechecked first; the `feed.ts` edit then only adds a resolvable import + one call.
