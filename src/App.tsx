import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { tierForScore } from "./tiers";
import { HERO_FEED, fetchLiveFeed, applyShield, ytId, type FeedItem } from "./feed";
import { fetchOuraReadiness } from "./sources/oura";
import { writeDiary, readDiary, type DiaryEntry } from "./lib/insforge";

// FLIP (First-Last-Invert-Play) reorder animation for the feed cards. On the Sharp↔Fog
// flip the sort order changes; without this, cards teleport to their new grid cell. This
// measures each card's old vs new position and slides it home, so shielded cards visibly
// *rise* to the top as they un-blur — the concept's named wow.
//
// Demo-floor safe by construction: it only decorates rendering. If `el.animate` is missing,
// reduced-motion is set, or anything throws, it no-ops and the cards are already in their
// final position (today's instant-reorder behavior). It never feeds back into state.
function useFlipReorder(orderKey: string) {
  const positions = useRef(new Map<string, DOMRect>());
  const nodes = useRef(new Map<string, HTMLElement>());

  const register = (el: HTMLElement | null, id: string) => {
    if (el) nodes.current.set(id, el);
    else nodes.current.delete(id);
  };

  useLayoutEffect(() => {
    try {
      const reduce =
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;
      const prev = positions.current;
      const next = new Map<string, DOMRect>();

      for (const [id, el] of nodes.current) {
        const rect = el.getBoundingClientRect();
        next.set(id, rect);
        const old = prev.get(id);
        if (!old || reduce || typeof el.animate !== "function") continue;
        const dx = old.left - rect.left;
        const dy = old.top - rect.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        // composite:"add" layers the slide on top of the card's CSS transform (scale .97
        // while shielded), so the un-blur scale survives and there's no pop on release.
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
          { duration: 520, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", composite: "add" }
        );
      }
      positions.current = next;
    } catch {
      // Decorative only — never let the slide break the feed.
    }
  }, [orderKey]);

  return register;
}

export default function App() {
  // Readiness drives everything. Default to Fog so the first impression is calm,
  // then the "What if I were Sharp?" flip is the wow. Real Oura overrides this.
  const [score, setScore] = useState(61);
  const [overrides, setOverrides] = useState<Set<string>>(new Set());
  const [live, setLive] = useState<FeedItem[]>([]);
  // Recent readings shown in the "weather diary" strip (the NASI Memory pillar).
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  // Tap-to-play: a YouTube video open in the lightbox (id); plus the card hovered for inline preview.
  const [modalVideo, setModalVideo] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  // Source filter chips: sources toggled OFF here are hidden from the feed.
  const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());
  // Once the user drags the slider, their value wins — a late Oura response must not
  // clobber it. A ref (not state) so the async effect reads it without re-rendering.
  const userTouched = useRef(false);
  // Last readiness we persisted, so a debounced settle doesn't write a duplicate row.
  const lastWritten = useRef<number | null>(null);

  const tier = tierForScore(score);

  // Apply the morph to the document root so the whole page themes.
  useEffect(() => {
    document.documentElement.setAttribute("data-tier", tier.key);
  }, [tier.key]);

  // Pull live content once (no-op until the loop wires the sources).
  useEffect(() => {
    fetchLiveFeed().then(setLive).catch(() => {});
  }, []);

  // Load the recent weather diary once on mount (InsForge, or localStorage fallback).
  useEffect(() => {
    readDiary().then(setDiary).catch(() => {});
  }, []);

  // Seed readiness from real Oura data on load. Only applies if the user hasn't
  // already taken over the slider, and only if Oura returned a usable score —
  // otherwise the default stands and the demo floor is untouched.
  useEffect(() => {
    fetchOuraReadiness()
      .then((s) => {
        if (s != null && !userTouched.current) setScore(s);
      })
      .catch(() => {});
  }, []);

  // The feed's base set: live content, or the curated floor only if everything came back empty.
  const baseItems = live.length ? live : HERO_FEED;

  // Every source present, for the clickable filter chips (independent of what's toggled off).
  const sources = useMemo(
    () => Array.from(new Set(baseItems.map((i) => i.source))),
    [baseItems]
  );

  const items = useMemo(() => {
    const all = baseItems.filter((it) => !hiddenSources.has(it.source));
    // Sort so EVERY tier change reorders the grid (this is what the FLIP shuffle animates):
    //  · unshielded cards (intensity ≤ ceiling) always lead; shielded ones sink below the fold
    //  · Sharp leads with the most intense ("bring it on")
    //  · calmer tiers lead with the softest, and within the shielded group the most intense
    //    sinks deepest — so raising the ceiling lifts the newly-un-shielded cards up THROUGH
    //    the fold. That's why Fog→Perseverance now shuffles just like Perseverance→Sharp.
    const ceil = tier.ceiling;
    const sorted = [...all].sort((a, b) => {
      const aS = a.intensity > ceil ? 1 : 0;
      const bS = b.intensity > ceil ? 1 : 0;
      if (aS !== bS) return aS - bS; // unshielded first
      if (tier.key === "SHARP") return b.intensity - a.intensity;
      return aS
        ? b.intensity - a.intensity // shielded group: most intense sinks deepest
        : a.intensity - b.intensity; // visible group: softest leads
    });
    return applyShield(sorted, ceil);
  }, [baseItems, hiddenSources, tier.ceiling, tier.key]);

  const shieldedCount = items.filter((i) => i.shielded && !overrides.has(i.id)).length;

  // Re-run the FLIP slide whenever the rendered card order changes (the flip re-sorts).
  const orderKey = items.map((i) => i.id).join(",");
  const register = useFlipReorder(orderKey);

  const reduceMotion =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  // In Sharp ("content on steroids") the top video auto-plays inline (muted); others play on
  // hover. Honors reduced-motion by not auto-playing anything.
  const autoPlayId =
    tier.key === "SHARP" && !reduceMotion
      ? items.find((i) => !i.shielded && i.url && ytId(i.url))?.id
      : undefined;

  // Persist each *settled* reading. Debounced ~900ms (matches the morph feel) so dragging
  // the slider writes one row when you stop, not one per pixel. Guarded so a failed write
  // (or missing keys → localStorage) can never break the demo. Optimistically prepends the
  // stored entry so the diary strip updates without waiting on a re-read.
  useEffect(() => {
    const t = setTimeout(async () => {
      if (score === lastWritten.current) return;
      try {
        const stored = await writeDiary({
          readiness: score,
          tier: tier.key,
          shielded_count: shieldedCount,
          overrides: [...overrides],
        });
        lastWritten.current = score;
        setDiary((prev) => [stored, ...prev].slice(0, 12));
      } catch {
        // writeDiary never throws, but stay defensive — the demo floor must survive.
      }
    }, 900);
    return () => clearTimeout(t);
  }, [score, tier.key, shieldedCount, overrides]);

  // Esc closes the video lightbox.
  useEffect(() => {
    if (!modalVideo) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setModalVideo(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalVideo]);

  function override(id: string) {
    setOverrides((prev) => new Set(prev).add(id));
  }

  // Open a card: YouTube → in-app lightbox player; anything else → a new tab.
  function openItem(it: FeedItem) {
    const vid = it.url ? ytId(it.url) : undefined;
    if (vid) setModalVideo(vid);
    else if (it.url) window.open(it.url, "_blank", "noopener,noreferrer");
  }

  // Toggle a source chip on/off; the feed re-filters and re-shuffles (FLIP animates it).
  function toggleSource(s: string) {
    setHiddenSources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  return (
    <>
      <div className="atmos" aria-hidden>
        <div className="grid" />
        <div className="rain" />
        <div className="fog" />
      </div>

      <main className="app">
        <header className="header">
          <div className="titlebar">
            <span className="brand">◐ Inner Weather</span>
          </div>

          <div className="readout-row">
            <div className="blurb">{tier.blurb}</div>
            <div className="readout">
              <span className="score">{score}</span>
              <span className="tiername">{tier.label}</span>
            </div>
          </div>

          <div className="control">
            <span className="slider-end">Fog</span>
            <input
              className="slider"
              type="range"
              min={50}
              max={98}
              value={score}
              onChange={(e) => {
                userTouched.current = true;
                setScore(Number(e.target.value));
              }}
              aria-label="Oura readiness"
            />
            <span className="slider-end">Sharp</span>
          </div>

          <div className="mode-tag">NASI · {tier.mode} mode · 🛡 {shieldedCount} shielded</div>
        </header>

        {diary.length > 0 && (
          <>
            <div className="divider" aria-hidden />
            <div className="diary" aria-label="weather diary">
              <span className="diary-label">weather diary · recent readings</span>
              <div className="diary-track">
                {diary
                  .slice()
                  .reverse()
                  .map((d) => (
                    <span
                      key={d.id ?? d.created_at}
                      className="diary-chip"
                      data-tier={d.tier}
                      title={`${d.readiness} · ${d.tier}`}
                    >
                      {d.readiness}
                    </span>
                  ))}
              </div>
            </div>
          </>
        )}

        <div className="divider" aria-hidden />

        <div className="feed-head">
          <span className="feed-title">Content drawn from</span>
          <div className="feed-sources">
            {sources.map((s) => {
              const off = hiddenSources.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  className={`src-tag${off ? " off" : ""}`}
                  onClick={() => toggleSource(s)}
                  aria-pressed={!off}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <span className="shield-note">
            showing intensity ≤ {tier.ceiling} · your ring decides what gets through
          </span>
        </div>

        <section className="feed">
          {items.map((it, idx) => {
            const shielded = it.shielded && !overrides.has(it.id);
            const vid = it.url ? ytId(it.url) : undefined;
            const playable = !shielded && !!it.url;
            const playing = playable && !!vid && (hovered === it.id || autoPlayId === it.id);
            return (
              <article
                key={it.id}
                ref={(el) => register(el, it.id)}
                className={`card${shielded ? " shielded" : ""}${playable ? " playable" : ""}${
                  it.thumbnail ? "" : " noimg"
                }`}
                style={{ "--i": idx } as CSSProperties}
                onClick={() => playable && openItem(it)}
                onMouseEnter={() => playable && vid && setHovered(it.id)}
                onMouseLeave={() => setHovered((h) => (h === it.id ? null : h))}
              >
                <div className="media">
                  {playing ? (
                    <iframe
                      className="thumb hoverplay"
                      src={`https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&loop=1&playlist=${vid}`}
                      title=""
                      allow="autoplay; encrypted-media"
                    />
                  ) : (
                    <>
                      {it.thumbnail && (
                        <img
                          className="thumb"
                          src={it.thumbnail}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => e.currentTarget.remove()}
                        />
                      )}
                      <span className="emoji">{it.emoji ?? "🗞️"}</span>
                      {vid && <span className="playbadge">▶</span>}
                    </>
                  )}
                </div>
                <div className="cbody">
                  <div className="ctitle">{it.title}</div>
                  <div className="meta">
                    <span className="dot" />
                    i{it.intensity} · {it.source}
                  </div>
                </div>
                <div className="shieldveil">
                  <span className="lock">🛡</span>
                  <span className="stxt">shielded — your ring says rest</span>
                  <span
                    className="override"
                    onClick={(e) => {
                      e.stopPropagation();
                      override(it.id);
                    }}
                  >
                    tap to override
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        {modalVideo && (
          <div className="modal" onClick={() => setModalVideo(null)}>
            <div className="modal-inner" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setModalVideo(null)} aria-label="Close video">
                ✕
              </button>
              <iframe
                src={`https://www.youtube.com/embed/${modalVideo}?autoplay=1&rel=0`}
                title="Video player"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        )}
      </main>
    </>
  );
}
