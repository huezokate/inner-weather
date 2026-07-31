# Inner Weather — Video Walkthrough & Voiceover Draft (v2)

A creator-facing shooting guide plus two ready-to-read voiceover scripts for demoing
**Inner Weather** — "a weather forecast for your nervous system." Your **Oura** readiness
score, piped in over **MCP**, sets a daily *tier* (Fog / Perseverance / Sharp, ceilings
2 / 3 / 5) that shields high-intensity content. The wow moment is dragging the Fog↔Sharp
slider and watching the whole page morph from rainy purple to clean white — a transition
that now interpolates in **OKLCH color space** and stays **WCAG AA-readable at every
frame**.

> **Hero of the video:** Oura + the MCP-powered adaptive interface. The accessibility /
> design-craft angle (WCAG, "contrast is law," advocating for users) is the supporting
> theme — real and worth saying, but it never upstages the Oura demo.

---

## 1. Format, structure & shooting notes

- **Structure = talking-head intro → voiceover walkthrough.** Film the **intro to camera**
  (you, on webcam or phone — warm, direct). The moment the app appears and the walkthrough
  starts, **cut to a screen recording with your voiceover** over it. Come back to your face
  only for the sign-off. This is the spine of both cuts.
- **Shoot horizontal (16:9), frame safe for vertical.** Record the screen at 1920×1080 and
  keep the slider, the score/tier readout, and the top row of cards inside a centered 9:16
  safe area, so the same capture crops cleanly to a vertical (Reels / TikTok / Shorts) cut
  without re-shooting.
- **Two lengths from one shoot:**
  - **~60s short** — the social hook: talking-head intro → one Fog→Sharp drag → sign-off.
  - **~5 min extended** — the full walkthrough: intro, the Oura + MCP "why," a tour of the
    tiers, the flip, live sources, the diary, a short word on craft, close.
- **Screen prep:** open `localhost:5173` (or the deployed `inner-weather-swart.vercel.app`).
  The app loads on **score 61 → FOG** on purpose, so the first frame is calm and rainy — a
  perfect cold open. Drag the slider around once before recording so the "weather diary"
  strip already has a few chips of history.
- **Pace the drag slowly.** The morph runs ~900ms and the cards un-blur in a staggered wave
  (~45ms apart). A slow drag lets the camera catch the wave and the smooth OKLCH color glide;
  a fast flick hides both.

---

## 2. On-screen shot list

1. **Cold open — Fog.** Full page at rest: dusty purple background, drifting rain, the
   `◐ INNER WEATHER` header, score **61**, tier **FOG**, blurb *"Foggy. Rest is data too."*
   The hustle / hot-take cards (🔥 💢 🚀 📈) are frosted; turtle, rain, otters, tea are clear.
2. **The control.** Cursor grabs the **Fog ↔ Sharp slider**. Point out `🛡 N shielded` and
   *"showing intensity ≤ 2 · your ring decides what gets through."*
3. **The flip — Fog → Sharp.** Drag slowly right. The whole page morphs purple→white (smooth,
   no gray dip — that's OKLCH), rain clears, blurred cards un-blur in a wave and slide up, the
   score climbs **61 → 88**, tier morphs **FOG → SHARP**, shielded count drops to **0**, and
   the top video auto-plays inline.
4. **The reverse (optional).** Drag back to Fog — spicy cards re-frost and sink, rain returns.
5. **Live sources (extended).** Toggle a source chip (curated / reddit / you.com / mastodon /
   hacker news) and watch the feed re-filter live — real current content, shielded by tier.
6. **The diary (extended).** Hover the **weather diary** strip — colored chips of past
   readings, each in its own tier's colors. Your nervous system over time.
7. **Sign-off — back on your face.**

---

## 3. Voiceover — ~60s short cut

*(~165 words ≈ 60–65s. Timecodes are guides.)*

**[0:00–0:09 — talking head]**
Hi, I'm Kate. I build products that are actually *kind* to the people using them —
accessible, a little beautiful, and genuinely good for your life. The interface is the only
part of any software a person ever really touches, so that's where I think we owe them the
most.

**[0:09–0:20 — cut to voiceover, Fog screen]**
I'm obsessed with my Oura ring. Every morning it scores how rested I am — and through Oura's
MCP, that signal drives this whole app. Imagine software that adapts to how you actually
feel. That's a twenty-first century I can stand behind.

**[0:20–0:48 — the slider drag, Fog → Sharp]**
This is **Inner Weather** — a feed that adapts to your readiness. Foggy day? It shields the
hustle and the hot takes and keeps things calm. But when your ring says you're *sharp* —
watch — the whole page wakes up and the edge comes back. And it morphs in OKLCH color, so
it stays perfectly readable at every single frame. Contrast is law, not a nice-to-have.

**[0:48–0:58 — talking head]**
A filter — but also a mirror. Powered by Oura, adapting in real time. That's Inner Weather.
Thanks for watching.

---

## 4. Voiceover — ~5 min extended cut

*(Section headers map to the shot list. ~750 words ≈ 5 min with pauses for on-screen action.
Intro and close are to camera; everything between is voiceover over the screen recording.)*

### Intro *(talking head)*
Hey — I'm Kate. Quick intro before I show you something I'm really proud of. I build software,
and the thing I care about most is that it's *for* people — accessible, inviting, and honestly
a little beautiful. I don't think those are a tax on a product; I think they're the point. The
interface is the only part of any software a human ever actually touches — so as designers and
developers, that surface is exactly where we get to advocate for the person on the other side.
And the frontier I find most exciting is **adaptive** technology: software that adjusts to
*you* instead of forcing you to adjust to it.

### The Oura + MCP "why"
Here's where this one started. I wear an Oura ring, and I'm a little obsessed. Every morning it
hands me a readiness score — basically, how recovered my nervous system is. And the more I lived
with that number, the more I thought: this is such rich signal, and almost nothing in my digital
life uses it. So I wired Oura into this app over **MCP** — the readiness score flows straight in
and becomes the thing that drives the entire interface. Imagine an internet that could tell you
were running on empty and quietly turned the volume down. That's completely buildable today —
and that's what this is.

### Meet Inner Weather *(cut to voiceover, Fog screen)*
This is **Inner Weather** — a weather forecast for your nervous system. Your Oura readiness sets
a daily *tier* — I've got three: **Fog**, **Perseverance**, and **Sharp** — and each tier is a
shield over your feed. Right now we're in **Fog**. Score's 61. Look at the whole vibe — dusty
purple, a little rain, and the header just says *"Foggy — rest is data too."* On a day like this
the filter only lets the gentle stuff through: a turtle eating a strawberry, ten hours of rain on
a tent, otters holding hands. Meanwhile the hustle content and the angry hot takes — *"your
morning routine is cope," "10x your output"* — see how they're blurred out? Your ring decided
those don't get to reach you today.

### The flip *(the slow slider drag)*
Now here's the part I love. This slider is your inner weather — Fog on the left, Sharp on the
right. Watch as I drag toward Sharp… the entire page morphs from rainy purple to clean white, the
score climbs to 88, and every blurred card un-blurs in a wave and slides up to the top. And notice
how *smooth* that color shift is — no muddy gray in the middle. That's because it interpolates in
OKLCH color space, and it holds WCAG-level contrast the entire way, so it never becomes
unreadable mid-transition. For me that's non-negotiable: adaptation should be unbounded in
direction but bounded in legibility. Contrast is law. In Sharp the header says *"Everything is
clicking — bring it on,"* the top video plays on its own, and the edge is fully back. And it goes
both ways — drag back to Fog and the spicy stuff re-frosts and sinks.

### Live content, real sources *(toggle a source chip)*
And this isn't a canned reel. Inner Weather pulls live content from real public sources — curated
picks, Reddit, You.com search, Mastodon, Hacker News — and every item gets scored for intensity
and shielded by your tier. I can toggle any lane on or off, and the feed re-filters live. If a
source ever fails, the curated feed keeps the experience intact — it never breaks.

### The diary — memory *(hover the diary strip)*
One more piece: memory. Every reading gets logged into this little weather diary — a strip of your
recent inner-weather days, each chip in its own tier's colors. Over time it becomes a picture of
your nervous system, not just a snapshot. Rest is data too.

### Close *(talking head)*
So that's **Inner Weather**. It's a filter — it protects your bandwidth on the days you don't have
much. But it's also a mirror: the interface *itself* is the signal, calming you when you're foggy
and bringing the edge up when you're sharp — all driven by Oura, over MCP, in real time. It's my
little bet on a kinder, adaptive internet that actually respects the person using it. Thanks so
much for watching — I'd love to hear what you think.

---

## 5. Quick reference — facts to get right

| Tier | Readiness | Ceiling | Vibe on screen | Header blurb |
|------|-----------|---------|----------------|--------------|
| **Fog** | 50–69 | 2 | purple bg, drifting rain, desaturated cards | *"Foggy. Rest is data too."* |
| **Perseverance** | 70–79 | 3 | warm beige hinge, rain gone | *"Warming up. Give it an hour."* |
| **Sharp** | 80–98 | 5 | white bg, vivid cards, top video auto-plays | *"Everything is clicking. Bring it on."* |

- Intensity scale 1–5: **1 soothing · 2 calm · 3 neutral · 4 activating · 5 agitating.**
- The interaction is a **slider**, not a button. Palette is **Warhol pop-art purple / beige /
  white** — not neon.
- App loads on **61 / Fog** by default so the cold open is calm.
- The Fog↔Sharp morph now interpolates in **OKLCH** (≈900ms, calm easing) and passes **WCAG AA**
  contrast at every tier — mention the smoothness on camera; drag slowly so it reads.
- Oura + the MCP-powered adaptive interface is the hero. WCAG / design-craft is the supporting
  theme.
