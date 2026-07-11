# Terrarium — Design System (web)

Earth-modern, calm, botanical. Soft warm neutrals, forest green, one terracotta accent
per screen. Generous whitespace, soft corners, one shadow + a hairline border. Ported
from the app's token engine (`src/constants/theme.ts`) — values are 1:1.

Two "vibes" (themes): **Glasshouse** (default, earth-modern) and **Conservatory**
(deep-jungle, gold accent). Each has light + dark. Use Glasshouse light unless told otherwise.

---

## Drop-in CSS

```css
:root {
  /* color — Glasshouse light (default) */
  --background: #F6F4EC;       /* page */
  --surface: #FCFBF6;          /* card */
  --surface-sunken: #EFEDE2;   /* inset / selected */
  --primary: #2E5D3A;          /* forest — primary actions */
  --on-primary: #FCFBF6;       /* text/icon on primary fill */
  --sage: #5E7A52;             /* secondary */
  --accent: #A55A3A;           /* terracotta — ONE per screen */
  --text: #232826;
  --text-muted: #6B7268;
  --border: rgba(46,93,58,0.12); /* forest-tinted hairline */

  /* spacing — 4·8·16·24·32·48, never off-scale */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-xxl: 48px;

  /* radii */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 999px;

  /* type — base 16, ratio 1.2 (minor third); system fonts */
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-serif: ui-serif, Georgia, serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;

  /* elevation — one soft shadow + the hairline is the premium floor */
  --shadow-e0: 0 2px 8px rgba(0,0,0,0.06);
  --shadow-e1: 0 8px 24px rgba(0,0,0,0.10);
  --shadow-e2: 0 12px 32px rgba(0,0,0,0.16);

  /* motion */
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --dur-micro: 120ms;   /* fades, chip select */
  --dur-snappy: 180ms;  /* buttons, toggles, tabs */
  --dur-settle: 280ms;  /* sheets, modals, pages */

  --max-content: 760px; /* center, cap, never edge-to-edge */
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #14201A;
    --surface: #1C2A22;
    --surface-sunken: #243528;
    --primary: #5FAE74;
    --on-primary: #14201A;
    --sage: #8FB07F;
    --accent: #C8825F;
    --text: #ECEFE7;
    --text-muted: #9AA59A;
    --border: rgba(143,176,127,0.16);
  }
}

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: var(--dur-micro) !important; transition-duration: var(--dur-micro) !important; }
}
```

---

## Type scale

| Role      | size / line / weight        | use                                  |
|-----------|-----------------------------|--------------------------------------|
| display   | 33 / 38 / 700, ls -0.5      | hero / page title                    |
| headline  | 28 / 34 / 700               | section header                       |
| title     | 23 / 28 / 600               | card title                           |
| subhead   | 19 / 24 / 600               | sub-section                          |
| body      | 16 / 24 / 400               | paragraphs                           |
| caption   | 13 / 18 / 600               | metadata, labels                     |
| overline  | 11 / 14 / 500, ls 0.8, UPPERCASE, muted | eyebrow labels           |

Bold the value, never the label. Overline is uppercase + letter-spaced + `--text-muted`.

---

## Rules

- **One accent per screen.** Terracotta (`--accent`) is a spotlight, not a theme color. Green carries the brand.
- **Off-token values are forbidden.** Every margin, radius, font-size comes from a variable above.
- **Elevation = one shadow + hairline border.** Use `--shadow-e0` for cards, `e1` for popovers/sheets, `e2` for modals. Always pair with `border: 1px solid var(--border)`.
- **Content max-width 760px**, centered, with `--space-xl`+ side padding. Never edge-to-edge text.
- **Spacing intent:** within a group `xs–sm`; between groups `md–lg`; section padding `lg–xl`; screen breathing room `xl–xxl`.

---

## Component recipes

**Button (primary)**
```css
background: var(--primary); color: var(--on-primary);
padding: var(--space-sm) var(--space-lg); border-radius: var(--radius-pill);
font: 600 16px/1 var(--font-sans); border: none;
transition: transform var(--dur-snappy) var(--ease);
```
Secondary = `background: transparent; color: var(--primary); border: 1px solid var(--border);`

**Card**
```css
background: var(--surface); border: 1px solid var(--border);
border-radius: var(--radius-lg); box-shadow: var(--shadow-e0);
padding: var(--space-lg);
```

**Chip / tag**
```css
background: var(--surface-sunken); color: var(--text-muted);
padding: var(--space-xs) var(--space-md); border-radius: var(--radius-pill);
font: 600 13px/1 var(--font-sans);
```
Selected: `background: var(--primary); color: var(--on-primary);`

---

## Conservatory vibe (alt theme)

Swap the color block for a deeper-jungle mood with a gold accent.

```css
/* light */  --background:#EEF1E6; --surface:#F7F9F0; --surface-sunken:#E3E8D6;
--primary:#1F4D2E; --on-primary:#F7F9F0; --sage:#4E6B43; --accent:#8C6A1B;
--text:#1C231C; --text-muted:#5F6B59; --border:rgba(31,77,46,0.14);
/* dark */   --background:#0E1A12; --surface:#152217; --surface-sunken:#1D2D1F;
--primary:#5BB873; --on-primary:#0E1A12; --sage:#86A877; --accent:#E0B94E;
--text:#E8EFE0; --text-muted:#94A38E; --border:rgba(91,184,115,0.18);
```
