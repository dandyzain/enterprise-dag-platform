# NexusFlow Design System — "Mission Control"

Precise, dark-first UI with a real light theme. Surfaces stay neutral; one
signature **signal gradient** (emerald → cyan → blue, from the logo) is reserved
for live/active states — the running-node sweep, active navigation, progress.

## Tokens

All tokens live in `src/app/globals.css` as CSS variables, mapped into Tailwind v4
via `@theme inline`. Light/dark values are swapped by `next-themes`, which writes
`.dark` / `.light` on `<html>`. Token selectors are scoped to `:root` so third-party
`dark` / `light` classes (React Flow adds its own) can never leak into them.

| Group | Tailwind classes | Notes |
| --- | --- | --- |
| Surfaces | `bg-app`, `bg-surface`, `bg-surface-2`, `bg-surface-3`, `bg-overlay` | back → front layering |
| Lines | `border-line`, `border-line-strong` | default border colour is `line` |
| Text | `text-fg`, `text-fg-muted`, `text-fg-subtle` | `fg-subtle` keeps ≥ 4.5:1 on every surface |
| Accent | `text-accent`, `bg-accent-solid`, `text-accent-solid-fg` | primary actions |
| Status | `success`, `running`, `failed`, `warning` | always paired with an icon + label |
| Node types | `node-trigger`, `node-webhook`, `node-schedule`, `node-action`, `node-transform`, `node-delay`, `node-filter` | identity in the editor and thumbnails |
| Signal | `bg-signal`, `text-signal` | live/active states only |
| Elevation | `shadow-elev-1/2/3` | per-theme shadows |
| Code | `text-code-string/number/literal` | JSON highlighting, contrast-safe |

Status and node-type palettes were checked with a colour-vision validator in both
themes (lightness band, chroma floor, CVD separation, contrast vs surface). Text
never wears a data colour: badges use neutral text with a coloured dot.

**Type**: Geist Sans / Geist Mono (`next/font`, self-hosted). App base 14px,
metadata ≥ 12px, `tabular-nums` only for aligned number columns.

**Radii**: 6 / 8 / 10 / 14 / 20 px (`rounded-sm` … `rounded-2xl`).

**Breakpoints**: Tailwind defaults plus `xs` = 480px. Cards use container queries
(`@container`) where their content needs to reflow independently of the viewport.

## Motion

Tokens: `src/components/motion/presets.ts` (durations 100–480ms, `standard` /
`emphasized` / `exit` easings, `snappy` / `gentle` springs).

- Motion explains state; idle decoration never loops.
- Only `transform` / `opacity` animate (CLS stays 0).
- `MotionConfig reducedMotion="user"` + a global `prefers-reduced-motion` rule;
  SVG pulses are not rendered under reduced motion.
- Signature moments: running-node conic sweep, signal pulse along active edges,
  drawn success check, failure shake, animated auto-layout, sliding nav pill.
- Dashboard hero: drifting aurora (paused off-screen), word-by-word blur-in
  headline, rotating subtitle (static text for screen readers), a looping
  "live preview" that runs the latest workflow tier by tier with pointer tilt,
  and a one-shot shine on the primary CTA.

## Components

```
src/components/
  ui/        primitives on Radix — Button (loading), Badge, Input, Textarea, Field,
             Select, Dialog, Sheet, Drawer (vaul), Tabs, Segmented, DropdownMenu,
             Command (cmdk), Tooltip, Skeleton, Kbd, Card
  patterns/  PageHeader, PageContainer, StatCard + Sparkline, Meter, StatusBadge,
             EmptyState, ConfirmDialog, CopyButton, RelativeTime, JsonView,
             ResponsivePanel (sheet ≥ md, bottom sheet on phones), DagThumbnail
  shell/     AppShell, Sidebar, Topbar, MobileTabBar, CommandMenu, ThemeToggle,
             SystemStatus, NewWorkflowDialog
  motion/    presets, Reveal / RevealGroup, NumberTicker, useSpotlight
  canvas/    editor: nodes, edges, palette, picker, inspector, toolbar, run panel
```

Rules of thumb:

- Every icon-only control has an accessible name (and usually a tooltip).
- Overlays are Radix-based: focus trap, `Esc` to close, focus restore.
- Destructive actions confirm (type-to-confirm for irreversible ones) or offer undo.
- Per-viewer conveniences (view mode, panel widths, dismissed tips) use
  `localStorage` wrapped in `try/catch`; the UI renders correctly without it.

## Responsive strategy

| | Desktop (≥ 1024) | Tablet (768–1023) | Phone (< 768) |
| --- | --- | --- | --- |
| Shell | sidebar, collapsible to rail | rail | bottom tab bar + compact top bar |
| Data | tables | tables | stacked cards |
| Overlays | dialogs, side sheets | side sheets | bottom sheets (drag to dismiss) |
| Editor | palette · canvas · docked inspector · run panel | inspector overlays canvas | inspector & step picker as bottom sheets |

Touch: `pointer-coarse:` variants raise hit areas to ~40px; handles grow on touch.

## Quality gates

- axe-core (WCAG 2.2 AA): 0 violations across all routes and key overlays, both themes.
- No horizontal overflow at 360 / 390 / 768 / 1024 / 1280 / 1440 / 1920px.
- CodeMirror is code-split and only loads when a JSON field is shown; React Flow
  CSS/JS only loads on the editor route.
