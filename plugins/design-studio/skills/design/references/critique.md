# Design Critique Rubric

Score every created or revised frame across five axes (0–10 each). Any axis below **8/10** triggers a focused revision pass before delivery.

## Axes

1. **Token Fidelity (0–10)**
   - Uses `var(--color-*)`, `var(--font-*)`, `var(--radius-*)`, and `var(--space-*)` from `../tokens.css`.
   - Preserves neutral-surface dominance (≥ 85% neutral, accent reserved for primary CTA and active indicators).
   - Follows `DESIGN.md` depth rules (hairline borders and stepped surfaces over heavy drop shadows).

2. **Visual Hierarchy (0–10)**
   - Single unmistakable primary focal point within 2 seconds of scanning.
   - Clear typographic scale separation (display/page title ≥ 1.6x body on app views, ≥ 2.2x on hero views).
   - Secondary metadata visibly recedes via `--color-fg-muted` and smaller scale.

3. **Layout & Rhythm (0–10)**
   - Padding, gaps, and section cadence follow the 4px spacing rhythm cleanly.
   - Zero horizontal overflow, clipped labels, or colliding controls at the declared `viewport` dimensions.
   - Asymmetric or purposeful composition tailored to content rather than uniform equal-width filler grids.

4. **Content & Affordance Realism (0–10)**
   - Realistic domain copy, plausible metrics formatted with `font-variant-numeric: tabular-nums`, and crisp inline SVG icons.
   - Interactive elements show clear hover/focus/active affordances; missing brand images use explicit labeled wireframes.

5. **Craft & Restraint (0–10)**
   - Aligned baselines across rows, cards, and icon+label pairs.
   - Intentional negative space; every border, badge, and divider earns its pixels.

## Output Format

Record the critique concisely during revision (internal or reported if asked):

```text
Critique <frame-id>: Token 9 | Hierarchy 8 | Rhythm 7 | Realism 9 | Craft 8 (41/50)
Fixes:
- [Rhythm] Align KPI card heights and normalize section gap to 24px.
```
