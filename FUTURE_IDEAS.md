# Inner Weather — Future Ideas

> A weather forecast for your nervous system. Your readiness sets a *tier*
> (Fog / Perseverance / Sharp) that decides how much activating content gets
> through. v1 rebuilds a feed from open sources and shields it. The bigger
> vision is to make that shield a **layer between any user and any content**.

---

## The thesis

The scarce resource isn't content — it's nervous-system bandwidth. Inner Weather
treats "what should reach me right now?" as a function of physiological readiness.
Low readiness (Fog) → only calm, low-intensity content gets through; high readiness
(Sharp) → bring it on. The shield is the product. The feed is just where we first
demoed it.

---

## Where v1 is today

- Readiness (Oura) → 3-tier shield over a feed assembled from **open public sources**:
  Reddit (memes/GIFs via meme-api), Mastodon hashtag timelines, You.com, dev.to,
  Hacker News, YouTube. Source chips are toggleable filters.
- Warhol figure-ground morph, masonry tiles, tap-to-play video, tier-reactive motion,
  InsForge weather diary. Live at inner-weather-swart.vercel.app.

This proves the *experience*. The two ideas below are how it becomes a platform.

---

## The core challenge: closed feeds

The big platforms deliberately **do not expose the consumption feed** via API:

| Platform | Identity login | Read your home feed? |
|---|---|---|
| Instagram | via Meta/Graph (business, app review) | ❌ no feed API (Basic Display sunset Dec 2024) |
| LinkedIn | ✅ easy (OpenID Connect) | ❌ feed locked behind partner approval |
| X / TikTok | limited | ❌ effectively closed / paid |
| **Mastodon** | ✅ OAuth per instance | ✅ **authenticated home timeline IS in the API** |
| **Bluesky (AT Proto)** | ✅ app password / OAuth | ✅ **timeline + custom feeds readable** |

So "log in with Instagram/LinkedIn and shield my feed" is **not possible** through
official APIs — those logins give *identity only*. Two ways around it:

---

## Architecture A — In-app feed (what v1 does, extend it)

Pull from sources whose APIs are open, shield by readiness.

- **Best home for the literal thesis: Mastodon + Bluesky.** "Log in with Bluesky →
  Inner Weather shields your *actual* timeline by readiness." This is buildable now
  and is the most ownable, on-brand version of the idea.
- For closed platforms, swap "connect your feed" for **"connect your interests"**:
  identity login + let users pick topics / handles / subreddits / channels / hashtags;
  build a personalized stream from the open sources; shield *that*.

**Pro:** full control of UX, no host hostility. **Con:** it's a destination app — users
have to come to us instead of us meeting them where they already scroll.

---

## Architecture B — The overlay / plugin layer  ⭐ (the big idea)

Don't rebuild the feed. **Sit on top of the app the user is already in** and apply the
shield to the live page. A browser extension (content script) on instagram.com,
linkedin.com, x.com, tiktok.com, youtube.com, etc.:

1. Knows the user's current **readiness/tier** (Oura via the extension, or a manual
   slider in the popup — same engine as the app).
2. Scans the DOM for post/card elements (per-site adapters/heuristics).
3. **Classifies each post's intensity** on-device (keyword/engagement-bait heuristics:
   ALL CAPS, ragebait phrasing, outrage markers, plus optional small local model).
4. **Applies the shield in place** — blur / dim / desaturate / collapse / demote any
   post above the current tier's ceiling, with a "tap to override" reveal (exactly the
   app's interaction, but over real IG/LinkedIn).

This is the **"layer between user and content within the app they already use."** It
sidesteps the closed-API problem completely, because we're modifying *the user's own
rendering* of content they already have access to — the same category as ad blockers,
News Feed Eradicator, and Unhook for YouTube (all established, allowed tools).

**Pro:** works on *any* site, meets users where they are, no feed API needed.
**Con:** DOM fragility (markup changes), per-platform maintenance, mobile is hard
(iOS only allows content-blocker extensions — would likely need a focus-mode companion
app or a custom calm browser).

---

## Shield rules to explore (both architectures)

- **Blur unless you follow the creator** (Kate's idea) — a creator allowlist: known/
  followed voices come through clear; strangers/virality-juiced posts get frosted until
  you opt in. A trust gradient, not just an intensity gradient.
- **Tier ceilings** by readiness (today's model): Fog ≤2, Perseverance ≤3, Sharp ≤5.
- **Doomscroll brake** — in Fog, collapse infinite-scroll after N posts / suggest a stop.
- **Ragebait/outrage demotion** regardless of tier.
- **"Earned intensity"** — spicy content unlocks as readiness rises through a session.
- **Per-source/creator weather** — remember which accounts spike vs soothe *you*
  (the NASI Mood Engine / Memory pillars) and tune the shield personally over time.

---

## "Log in" — the realistic pattern

- **Identity:** Sign-in-with Google / Apple / LinkedIn / Bluesky for accounts, the
  per-user weather diary, and saved preferences. InsForge auth already covers this.
- **Feed access:** only where the API allows it (Mastodon, Bluesky) for Architecture A;
  for everything else, Architecture B reads the rendered page, not an API.
- ⚠️ **Never scrape** closed feeds server-side or republish content — ToS violation,
  fragile, legally dicey. The overlay is fine precisely because it only re-styles the
  user's *own* in-browser view and never exfiltrates content.

---

## Risks & guardrails

- **Privacy first:** classify on-device; never send the user's feed/DOM off the client.
- **ToS posture:** modify rendering only; never automate actions (likes/follows/posts);
  no storage/forwarding of others' content. Stay in the accessibility-tool lane.
- **Fragility:** per-platform DOM adapters will need upkeep as sites change.
- **Mobile gap:** extensions are desktop-first; mobile needs a different vehicle.

---

## North star

> f.lux / an ad-blocker, but for *emotional intensity*. A calm layer you wear over the
> internet, tuned to your nervous system. The feed demo proves it; the overlay ships it
> everywhere; Mastodon/Bluesky make the "shield my real timeline" promise literally true.
