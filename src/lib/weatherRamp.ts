// Weather ramp — the F13 OKLCH engine applied to the tier morph.
//
// The three tier palettes stay exactly as designed in index.css; this module
// turns the space between them into a readiness CONTINUUM. Readiness maps to
// t ∈ [0,1] (tiers.power) and every t is its own palette along the warm side of
// the color wheel: purple → mauve/pink → peach → beige (t=0.5, ≈ score 74) →
// near-white. Instead of CSS hex-lerping in sRGB (purple → gray mush → white),
// interpolation is perceptual OKLCH with shorter-arc hue, and every resolved
// palette passes the F13 contrast gate (WCAG AA floor, ported from
// f13/src/lib/f13/gate.ts) so text stays legible even in the muddy middle of a
// figure-ground inversion. Tier boundaries still exist for content behavior —
// color just stopped being quantized to them.
//
// Demo-floor safe: pure functions only. If the caller (App.tsx) hits any error
// it clears the inline vars and the [data-tier] hex themes take over unchanged.

import { clampChroma, converter, wcagContrast } from "culori";
import type { TierKey } from "../tiers";

interface Oklch {
  l: number; // 0–1
  c: number; // 0–~0.37
  h: number; // 0–360
}

const toOklch = converter("oklch");

function fromHex(hex: string): Oklch {
  const c = toOklch(hex);
  if (!c) throw new Error(`unparseable color: ${hex}`);
  return { l: c.l ?? 0, c: c.c ?? 0, h: c.h ?? 0 };
}

function inGamut(color: Oklch): Oklch {
  const clamped = clampChroma({ mode: "oklch", ...color }, "oklch");
  return { l: clamped.l ?? color.l, c: clamped.c ?? 0, h: clamped.h ?? color.h };
}

function css(color: Oklch, alpha = 1): string {
  const g = inGamut(color);
  const a = alpha < 1 ? ` / ${alpha.toFixed(2)}` : "";
  return `oklch(${(g.l * 100).toFixed(2)}% ${g.c.toFixed(4)} ${g.h.toFixed(1)}${a})`;
}

function wcag(fg: Oklch, bg: Oklch): number {
  return wcagContrast(
    { mode: "oklch", ...inGamut(fg) },
    { mode: "oklch", ...inGamut(bg) }
  );
}

/* ── Anchors: the exact hex palettes from index.css, lifted to OKLCH ───────── */

type ColorRole = "bg" | "fg" | "card" | "accent" | "accent2" | "accent3" | "pop";
type Palette = Record<ColorRole, Oklch>;

interface Anchor {
  colors: Palette;
  fogOpacity: number;
  rainOpacity: number;
  borderAlpha: number;
  borderW: number; // px
  popOffset: number; // px
}

function anchor(
  hex: Record<ColorRole, string>,
  rest: Omit<Anchor, "colors">
): Anchor {
  const colors = Object.fromEntries(
    Object.entries(hex).map(([role, value]) => [role, fromHex(value)])
  ) as Palette;
  return { colors, ...rest };
}

const ANCHORS: Record<TierKey, Anchor> = {
  FOG: anchor(
    { bg: "#2e2150", fg: "#ede7f6", card: "#3d2e66", accent: "#ffa8d5", accent2: "#c9b3f0", accent3: "#ffd60a", pop: "#160d2b" },
    { fogOpacity: 0.5, rainOpacity: 0.16, borderAlpha: 0.5, borderW: 1.6, popOffset: 4 }
  ),
  PERSEVERANCE: anchor(
    { bg: "#e8dccb", fg: "#3a2e2a", card: "#f2eadd", accent: "#7a3f9e", accent2: "#9b4a2f", accent3: "#e91e8c", pop: "#d3c3a4" },
    { fogOpacity: 0.16, rainOpacity: 0, borderAlpha: 0.5, borderW: 1.6, popOffset: 4 }
  ),
  SHARP: anchor(
    { bg: "#ffffff", fg: "#4a2e8c", card: "#f4f0fb", accent: "#5a2ea6", accent2: "#e5197e", accent3: "#ffd60a", pop: "#4a2e8c" },
    { fogOpacity: 0, rainOpacity: 0, borderAlpha: 0.45, borderW: 1.8, popOffset: 5 }
  ),
};

/* ── Interpolation: shorter-arc hue = the warm route through pink/peach ────── */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function lerpHue(a: number, b: number, t: number): number {
  let d = ((b - a + 540) % 360) - 180; // shorter arc
  return (a + d * t + 360) % 360;
}

function mixColor(a: Oklch, b: Oklch, t: number): Oklch {
  // Truly achromatic endpoints (the white Sharp bg) have meaningless hue — adopt
  // the chromatic side's hue so the sweep doesn't detour through junk. Threshold
  // must stay tiny: low-chroma darks (Perseverance fg, c≈0.018) are genuinely
  // warm, and stealing their hue would tint the resting tier off-design.
  const ha = a.c < 0.005 ? b.h : a.h;
  const hb = b.c < 0.005 ? a.h : b.h;
  return { l: lerp(a.l, b.l, t), c: lerp(a.c, b.c, t), h: lerpHue(ha, hb, t) };
}

function mixAnchor(a: Anchor, b: Anchor, t: number): Anchor {
  const colors = Object.fromEntries(
    (Object.keys(a.colors) as ColorRole[]).map((r) => [r, mixColor(a.colors[r], b.colors[r], t)])
  ) as Palette;
  return {
    colors,
    fogOpacity: lerp(a.fogOpacity, b.fogOpacity, t),
    rainOpacity: lerp(a.rainOpacity, b.rainOpacity, t),
    borderAlpha: lerp(a.borderAlpha, b.borderAlpha, t),
    borderW: lerp(a.borderW, b.borderW, t),
    popOffset: lerp(a.popOffset, b.popOffset, t),
  };
}

/* ── The gate (F13 Thesis 5): AA floor on every frame, no disable flag ─────── */

const FLOOR = 4.5;

/** Worst contrast a color scores against every surface it must read on. */
function minContrast(color: Oklch, surfaces: Oklch[]): number {
  return Math.min(...surfaces.map((s) => wcag(color, s)));
}

/** Walk lightness in `direction` (chroma yields at the rail) until the color
 *  clears FLOOR against ALL surfaces at once. A per-pair walk can't work here:
 *  fixing accent-on-card by flipping it dark silently re-breaks accent-on-bg. */
function walkJoint(moving: Oklch, surfaces: Oklch[], direction: 1 | -1): Oklch {
  const color = { ...moving };
  let guard = 0;
  while (minContrast(color, surfaces) < FLOOR && guard++ < 300) {
    const railed = direction > 0 ? color.l >= 1 : color.l <= 0;
    if (railed) {
      if (color.c <= 0.004) break;
      color.c = Math.max(0, color.c - 0.02);
    } else {
      color.l = Math.min(1, Math.max(0, color.l + direction * 0.01));
    }
  }
  return color;
}

/** Away-from-the-surfaces first (stable in t — flips polarity once, at the
 *  lightness crossing); the other side only if that side has no AA room. */
function walkBoth(moving: Oklch, surfaces: Oklch[]): Oklch {
  const avgL = surfaces.reduce((sum, s) => sum + s.l, 0) / surfaces.length;
  const away: 1 | -1 = moving.l >= avgL ? 1 : -1;
  const primary = walkJoint(moving, surfaces, away);
  if (minContrast(primary, surfaces) >= FLOOR) return primary;
  const flipped = walkJoint(moving, surfaces, away === 1 ? -1 : 1);
  return minContrast(flipped, surfaces) > minContrast(primary, surfaces) ? flipped : primary;
}

/** Best floor ANY color could hit against these surfaces (pure white or black). */
function bestPossible(surfaces: Oklch[]): number {
  const white: Oklch = { l: 1, c: 0, h: 0 };
  const black: Oklch = { l: 0, c: 0, h: 0 };
  return Math.max(minContrast(white, surfaces), minContrast(black, surfaces));
}

/** The gate (F13 Thesis 5): AA floor, no disable flag. fg carries body copy and
 *  accent is text (tiername / badges / source tags) — both must read on bg AND
 *  card. accent2/accent3 are fills, not body text, and stay unclamped.
 *  Mid-ramp, bg and card can straddle mid-lightness so that NO color clears AA
 *  on both — then the surfaces yield (F13: "something always gives; the floor
 *  never does"): card converges toward bg until a passing ink exists. */
function gate(palette: Palette): Palette {
  const out = { ...palette };
  let guard = 0;
  while (bestPossible([out.bg, out.card]) < FLOOR + 0.1 && guard++ < 40) {
    out.card = mixColor(out.card, out.bg, 0.15);
  }
  const surfaces = [out.bg, out.card];
  if (minContrast(out.fg, surfaces) < FLOOR) out.fg = walkBoth(out.fg, surfaces);
  if (minContrast(out.accent, surfaces) < FLOOR) out.accent = walkBoth(out.accent, surfaces);
  return out;
}

/* ── Public API ────────────────────────────────────────────────────────────── */

/** Resolve the gated palette at morph position t ∈ [0,1] and return CSS vars. */
export function rampVars(t: number): Record<string, string> {
  const x = Math.min(1, Math.max(0, t));
  const mixed =
    x <= 0.5
      ? mixAnchor(ANCHORS.FOG, ANCHORS.PERSEVERANCE, x * 2)
      : mixAnchor(ANCHORS.PERSEVERANCE, ANCHORS.SHARP, (x - 0.5) * 2);
  const colors = gate(mixed.colors);
  return {
    "--bg": css(colors.bg),
    "--fg": css(colors.fg),
    "--card": css(colors.card),
    "--accent": css(colors.accent),
    "--accent2": css(colors.accent2),
    "--accent3": css(colors.accent3),
    "--border": css(colors.accent, mixed.borderAlpha),
    "--border-w": `${mixed.borderW.toFixed(2)}px`,
    "--pop-shadow": `${mixed.popOffset.toFixed(1)}px ${mixed.popOffset.toFixed(1)}px 0 ${css(colors.pop)}`,
    "--fog-opacity": mixed.fogOpacity.toFixed(3),
    "--rain-opacity": mixed.rainOpacity.toFixed(3),
  };
}

export const RAMP_VAR_NAMES = Object.keys(rampVars(0));
