import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { tierForScore } from "./tiers";
import { HERO_FEED, fetchLiveFeed, applyShield, type FeedItem } from "./feed";
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

  const items = useMemo(() => {
    const all = [...HERO_FEED, ...live];
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
  }, [live, tier.ceiling, tier.key]);

  const shieldedCount = items.filter((i) => i.shielded && !overrides.has(i.id)).length;

  // Re-run the FLIP slide whenever the rendered card order changes (the flip re-sorts).
  const orderKey = items.map((i) => i.id).join(",");
  const register = useFlipReorder(orderKey);

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

  function flipToSharp() {
    setScore((s) => (s >= 80 ? 61 : 88));
  }

  function override(id: string) {
    setOverrides((prev) => new Set(prev).add(id));
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
          <div>
            <div className="brand">◐ Inner Weather</div>
            <div className="blurb">{tier.blurb}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="readout">
              <span className="score">{score}</span>
              <span className="badge">{tier.label}</span>
            </div>
            <div className="mode-tag">NASI · {tier.mode} mode · 🛡 {shieldedCount} shielded</div>
          </div>
        </header>

        <div className="control">
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
        </div>

        <button className="flip" onClick={flipToSharp}>
          {score >= 80 ? "↺ What if I were Fog?" : "⚡ What if I were Sharp?"}
        </button>

        {diary.length > 0 && (
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
        )}

        <div className="shield-count">
          showing intensity ≤ {tier.ceiling} · your ring decides what gets through
        </div>

        <section className="feed">
          {items.map((it, idx) => {
            const shielded = it.shielded && !overrides.has(it.id);
            return (
              <article
                key={it.id}
                ref={(el) => register(el, it.id)}
                className={`card${shielded ? " shielded" : ""}`}
                style={{ "--i": idx } as CSSProperties}
              >
                <div className="media">
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
                  <span className="override" onClick={() => override(it.id)}>
                    tap to override
                  </span>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </>
  );
}
