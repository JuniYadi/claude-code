# Figma & External Spec Import

Load this reference when converting an incoming `.fig` file, Figma REST JSON export, or existing HTML/URL into `DESIGN.md` and `.design/frames/*.html`.

## Option A: Local `.fig` File (Offline via `@open-pencil/cli`)

Raw `.fig` archives are binary Kiwi-encoded files, not plain JSON. Inspect them offline with `@open-pencil/cli` (`npm i -g @open-pencil/cli` or `bunx @open-pencil/cli`):

```bash
# 1. Inspect page/frame hierarchy
openpencil tree input.fig

# 2. Extract real color palette, typography, spacing, and variables
openpencil analyze colors input.fig --json
openpencil analyze typography input.fig --json
openpencil variables input.fig --json

# 3. Query specific frames or export starter HTML/Tailwind
openpencil query input.fig "//FRAME[@width >= 360]" --json
openpencil export input.fig -f html
```

Map extracted variables and dominant palette/type tokens into `DESIGN.md` frontmatter, regenerate `.design/tokens.css`, then write clean semantic HTML frames in `.design/frames/` consuming those tokens.

## Option B: Figma JSON Export (REST API or Plugin JSON)

When given a Figma node tree JSON file:
1. Extract `styles` / `variables` / frequent `fills` (`r,g,b,a` → hex), `style.fontFamily`, `style.fontSize`, `cornerRadius`, and `itemSpacing` / `padding*`.
2. Deduplicate near-identical hex values into semantic tokens in `DESIGN.md`.
3. Map `layoutMode: "HORIZONTAL" | "VERTICAL"` directly to CSS Flexbox (`gap: itemSpacing`, `padding: paddingTop paddingRight paddingBottom paddingLeft`), preserving exact frame dimensions in `.design/frames.json`.

## Option C: Existing Codebase or Live URL

1. Read existing CSS variables, Tailwind config (`tailwind.config.*` / `@theme`), or computed styles into `DESIGN.md`.
2. Port each screen into one self-contained `.design/frames/<screen>.html` linked to `../tokens.css`.
3. Keep structural fidelity to the source first; create separate `<screen>-redesign.html` variants in the same `group` when proposing changes.
