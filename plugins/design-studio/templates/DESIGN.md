---
name: Default Studio System
version: 1
colors:
  bg: "#0b0c0e"
  surface: "#14161a"
  surface-elevated: "#1c1f26"
  border: "#262a34"
  fg: "#f2f4f8"
  fg-muted: "#9aa3b2"
  accent: "#3b82f6"
  accent-fg: "#ffffff"
  success: "#22c55e"
  warning: "#f59e0b"
  danger: "#ef4444"
typography:
  font-sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  font-display: "'Instrument Serif', 'Iowan Old Style', Georgia, serif"
  font-mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
  scale-ratio: 1.25
  body-size: "15px"
radii:
  sm: "6px"
  md: "10px"
  lg: "16px"
  pill: "999px"
spacing:
  unit: "4px"
  card-pad: "20px"
  section-gap: "28px"
motion:
  fast: "120ms cubic-bezier(0.2, 0, 0, 1)"
  base: "220ms cubic-bezier(0.2, 0, 0, 1)"
---

# Design System

Single source of truth for UI tokens and visual grammar. Edit frontmatter tokens here; regenerate `.design/tokens.css` from them.

## Aesthetic Direction
- **Posture:** Dense, crisp dark-first operational UI with editorial display headlines when presenting narrative or hero states.
- **Depth:** Use 1px hairline borders (`--color-border`) and stepped surface luminance (`--color-bg` → `--color-surface` → `--color-surface-elevated`) for hierarchy; keep shadows subtle and reserved for floating overlays.
- **Typography:** Sans-serif for UI controls and tables, tabular numerals (`font-variant-numeric: tabular-nums`) for metrics and counters, monospace for IDs/timestamps/code, display serif strictly for hero headlines ≥ 36px.
- **Color discipline:** Reserve `--color-accent` for primary actions and active states; keep ≥ 85% of viewport neutral. Semantic colors (`--color-success`, `--color-warning`, `--color-danger`) carry status meaning only.

## Layout Grammar
- **Grid:** 4px base rhythm; align card padding (`--space-card-pad`) and gaps (`--space-section-gap`) to multiples of 4px.
- **Hierarchy:** One primary focal region per frame, headline-to-body ratio ≥ 2.2x on landing/hero views, ≥ 1.6x on app views.
- **Content realism:** Populate frames with realistic domain copy, plausible metrics, and real SVG icons (clean 16–20px stroked paths). Mark missing brand imagery with explicitly labeled gray wireframe placeholders rather than fabricated assets.
