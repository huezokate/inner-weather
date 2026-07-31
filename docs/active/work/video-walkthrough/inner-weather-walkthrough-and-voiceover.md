# Inner Weather — Video Walkthrough & Voiceover Draft

A creator-facing shooting guide plus two ready-to-read voiceover scripts for demoing
**Inner Weather** — "a weather forecast for your nervous system." An Oura readiness score
sets a daily *tier* (Fog / Perseverance / Sharp, ceilings 2 / 3 / 5) that shields
high-intensity content. The wow moment is dragging the Fog↔Sharp slider and watching the
whole page invert from rainy purple to clean white while blurred hot-take cards un-blur in
a staggered wave and slide to the top.

---

## 1. Format & shooting notes

- **Shoot horizontal (16:9), frame safe for vertical.** Record the screen at 1920×1080.
  Keep the slider, the score/tier readout, and the top row of feed cards inside a centered
  9:16 safe area so the same capture crops cleanly to a vertical (Reels / TikTok / Shorts)
  cut without a re-shoot.
- **Two lengths from one shoot:**
  - **~60s short** — the hook cut for social. Face intro → one Fog→Sharp drag → sign-off.
  - **~5 min extended** — the full walkthrough for the portfolio / judges: intro, the Oura
    "why," a slow tour of the tiers, live sources, the diary, and the flip.
- **Talking head + screen:** open on your face (webcam or phone), then cut to a screen
  recording with your voiceover over it. In the short, picture-in-picture your face in a
  corner during the drag.
- **Screen prep:** open `localhost:5173` (or the deployed `inner-weather-swart.vercel.app`).
  The app loads on **score 61 → FOG** on purpose, so the first frame is calm and rainy —
  perfect cold open. Have a couple of diary chips already populated if you can (drag the
  slider around once before recording so the "weather diary" strip has history).
- **Pacing the drag:** move the slider **slowly** — the morph runs ~900ms and the cards
  un-blur staggered (each ~45ms after the last). A slow drag lets the camera catch the
  wave; a fast flick hides it.

---

## 2. On-screen shot list (what to show, in order)

1. **Cold open — Fog.** Full page at rest: dusty purple background, faint drifting rain,
   the `◐ INNER WEATHER` header, score **61**, tier **FOG**, blurb *"Foggy. Rest is data
   too."* The hustle / hot-take cards (🔥 💢 🚀 📈) are frosted; turtle, rain, otters, tea
   are clear.
2. **The control.** Cursor grabs the **Fog ↔ Sharp slider** (pink→yellow gradient track).
   Point out the `🛡 N shielded` count and *"showing intensity ≤ 2 · your ring decides what
   gets through."*
3. **The flip — Fog → Sharp.** Drag slowly right. The **whole page inverts** purple→white,
   rain clears, blurred cards **un-blur in a wave** and **slide up** to the top, the score
   climbs **61 → 88**, tier morphs **FOG → SHARP**, shielded count drops to **0**, and the
   top video **auto-plays inline**.
4. **The reverse (optional).** Drag back to Fog — spicy cards re-frost and sink, rain
   returns. Shows the loop is real, not a one-way trick.
5. **Live sources (extended cut).** Click a source chip (curated / reddit / you.com /
   mastodon / hacker news) to toggle a lane off and watch the feed re-filter and re-animate
   — real current content, correctly shielded by tier.
6. **The diary (extended cut).** Hover the **weather diary** strip — colored chips of past
   readings, each wearing its own tier's colors. This is the "Memory" — your nervous system
   over time.
7. **Sign-off — back on your face.**

---

## 3. Voiceover — ~60s short cut

*(Read at a warm, conversational pace. ~155 words ≈ 60s. Timecodes are guides.)*

**[0:00–0:10 — on your face]**
Hi, I'm Kate. I build products that are actually *kind* to the people using them —
user-friendly, a little beautiful, and genuinely good for your life. My favorite frontier
right now is adaptive tech: software that meets you where you are.

**[0:10–0:22 — hold on the rainy Fog screen]**
I'm obsessed with my Oura ring. It reads how rested I am every morning — so I thought,
what if our software actually *adapted* to how we feel? That, to me, is the twenty-first
century I can stand behind.

**[0:22–0:48 — the slider drag, Fog → Sharp]**
So I built **Inner Weather** — a social media filter that adapts to your restfulness. On a
foggy day it's a calm, rainy layer that shields the hustle and the hot takes and just lets
the gentle stuff through. But when your ring says you're *sharp* — watch — the whole thing
wakes up. The edge comes back. Everything flows.

**[0:48–1:00 — back on your face]**
It's a filter, but it's also a mirror — the interface itself tells you how you're doing.
That's Inner Weather. Thanks for watching.

---

## 4. Voiceover — ~5 min extended cut

*(Section headers map to the shot list above. Read conversationally; roughly 700–750 words ≈ 5 min with pauses for on-screen action.)*

### Intro *(on your face)*
Hey — I'm Kate. Quick intro before I show you something I'm really proud of. I build
software, and the thing I care about most is that it's *for* people — user-friendly,
inviting, accessible, and honestly a little beautiful. I don't think those things are a
tax on a product; I think they're the point. Tech should have real potential to make your
day better, not just take your attention. And the frontier I find most exciting is
**adaptive** technology — cutting-edge stuff that adjusts to *you* instead of forcing you
to adjust to it.

### The Oura "why"
Here's where this one started. I wear an Oura ring, and I'm kind of obsessed with it. Every
morning it hands me a readiness score — basically, how recovered my nervous system is. And
the more I lived with that number, the more I thought: this is such rich signal, and almost
nothing in my digital life uses it. Imagine if our software actually *adapted* to how we
feel. Imagine an internet that could tell you were running on empty and quietly turned the
volume down. That's the twenty-first century I can stand behind — and it's completely
buildable today.

### Meet Inner Weather *(cut to the Fog screen)*
So I built **Inner Weather**. I describe it as a weather forecast for your nervous system.
It's a social media filter that adapts to your restfulness, powered by my Oura ring through
an MCP integration. Your readiness score sets a daily *tier* — I've got three: **Fog**,
**Perseverance**, and **Sharp** — and each tier is a shield over your feed. Right now we're
in **Fog**. Score's 61. Look at the whole vibe — dusty purple, a little rain drifting over
everything, and the header just says *"Foggy — rest is data too."* On a day like this, the
filter only lets the gentle stuff through: a turtle eating a strawberry, ten hours of rain
on a tent, otters holding hands. Meanwhile all the hustle content and the angry hot takes —
*"your morning routine is cope," "10x your output,"* — see how they're blurred out? Your
ring decided those don't get to reach you today.

### The flip *(the slow slider drag)*
Now here's the part I love. This slider is your inner weather, Fog on the left, Sharp on the
right. Watch what happens as I drag toward Sharp… The entire page inverts — the purple and
the rain clear out to clean white, the score climbs up to 88, and every one of those blurred
cards un-blurs in a little wave and *slides up* to the top of the feed. Nothing was hidden —
it was just shielded, waiting for a day you could handle it. In Sharp, the header says
*"Everything is clicking — bring it on,"* the top video starts playing on its own, and the
edge is fully back. And it goes both ways — drag back toward Fog and the spicy stuff
re-frosts and sinks, the rain comes back. Same content, completely different nervous system.

### Live content, real sources *(toggle a source chip)*
And this isn't a canned demo reel. Inner Weather pulls live content from real public sources
— curated picks, Reddit, You.com search, Mastodon, Hacker News — and every single item gets
scored for intensity and shielded by your tier. I can toggle any lane on or off right here,
and the feed re-filters and re-animates live. If a source ever fails, the curated feed keeps
the experience intact — it never breaks.

### The diary — memory *(hover the diary strip)*
One more piece I care about: memory. Every reading gets logged into this little weather diary
— a strip of your recent inner-weather days, each chip wearing its own tier's colors. Over
time it becomes a picture of your nervous system, not just a snapshot. Rest is data too.

### Close *(back on your face)*
So that's **Inner Weather**. It's a filter — it protects your bandwidth on the days you don't
have much. But it's also a mirror: the interface *itself* is the signal, calming you when
you're foggy and bringing the edge up when you're sharp. It's my little bet on a kinder,
adaptive internet. Thanks so much for watching — I'd love to hear what you think.

---

## 5. Quick reference — the facts to get right

| Tier | Readiness | Ceiling | Vibe on screen | Header blurb |
|------|-----------|---------|----------------|--------------|
| **Fog** | 50–69 | 2 | purple bg, drifting rain, desaturated cards | *"Foggy. Rest is data too."* |
| **Perseverance** | 70–79 | 3 | warm beige hinge, rain gone | *"Warming up. Give it an hour."* |
| **Sharp** | 80–98 | 5 | white bg, vivid cards, top video auto-plays | *"Everything is clicking. Bring it on."* |

- Intensity scale 1–5: **1 soothing · 2 calm · 3 neutral · 4 activating · 5 agitating.**
- The interaction is a **slider**, not a button. The palette is **Warhol pop-art
  purple / beige / white** — not neon. (Older docs mention a "What if I were Sharp?" button
  and a neon-lime state; that's a retired design — don't script to it.)
- App loads on **61 / Fog** by default so the cold open is calm.
- Morph ≈ 900ms; cards un-blur staggered ~45ms apart — drag slowly on camera.
