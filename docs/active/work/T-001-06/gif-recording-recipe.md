# Recording `inner-weather-flip.gif`

The flip GIF could **not** be captured during the automated T-001-06 run: the Claude
browser extension was not connected (`tabs_context_mcp` → "Browser extension is not
connected"). The wow is fully working live — this is the one acceptance item a human (or a
later run with the extension connected) needs to finish. Two ways to do it.

## Option A — Claude `gif_creator` browser tool (the ticket's intended path)

Prereq: Claude browser extension installed + connected (https://claude.ai/chrome), Chrome
restarted if first install. Then, with the dev server running (`npm run dev`):

1. `tabs_create_mcp` → new tab; `navigate` it to `http://localhost:5173`.
2. `gif_creator start_recording` (tabId from step 1), then `computer screenshot`
   immediately to capture the initial **Fog** state as frame one.
3. `computer screenshot` 2–3 times over ~1s to pad leading frames (smooth playback).
4. `computer left_click` the **"⚡ What if I were Sharp?"** button (full-width, mid-page).
   Screenshot right after, then once more after ~900ms so the morph + un-blur + card slide
   are captured mid-flight and settled.
5. `computer left_click` the now-**"↺ What if I were Fog?"** button to flip back; screenshot
   through the reverse morph.
6. `computer screenshot` once more to pad the tail; `gif_creator stop_recording`.
7. `gif_creator export` with `download: true`, `filename: "inner-weather-flip.gif"`. Move
   the downloaded file to the repo root as `inner-weather-flip.gif`.

Tip: capturing extra frames before/after each click is what makes the morph read smoothly.

## Option B — Manual screen recording (no extension needed)

1. `npm run dev`, open `http://localhost:5173` in any browser, full-screen the window.
2. Start a screen recorder scoped to the browser:
   - macOS QuickTime: File → New Screen Recording (or `⌘⇧5`).
   - Or `ffmpeg`/Kap/Gifox for direct GIF.
3. Sit in **Fog** ~1s. Click **"What if I were Sharp?"** — watch the page snap to neon-lime,
   the rain stop, and the shielded hot-take cards un-blur and slide up. Wait ~1s. Click back
   to **Fog**. Stop after ~1s.
4. Convert to GIF if you recorded video, e.g.:
   ```bash
   ffmpeg -i flip.mov -vf "fps=20,scale=900:-1:flags=lanczos" inner-weather-flip.gif
   ```
5. Save as `inner-weather-flip.gif` at the repo root.

## What a good take shows

- Whole-frame morph: dusty-violet + heavy rain → black-green + neon-lime razor borders.
- The shielded cards (`🔥` hot take, `💢` AI-slop take, the hustle cards) **un-blur in a
  staggered wave** and **slide** to the top (FLIP), rather than teleporting.
- The header readiness 61 → 88 and the badge Fog → Sharp; shield count drops to 0.
- ~3–5 seconds, looping. The reverse flip (Sharp → Fog) makes the loop satisfying.
