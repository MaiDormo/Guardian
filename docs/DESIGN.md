# Guardian — Design Tokens

Generated from `mockup.html`. Material Design 3 token system.

---

## Border Radius

| Token | Value | px |
|---|---|---|
| `DEFAULT` | `0.125rem` | 2px |
| `lg` | `0.25rem` | 4px |
| `xl` | `0.5rem` | 8px |
| `full` (2xl) | `0.75rem` | 12px |

---

## Spacing

| Token | Value | px |
|---|---|---|
| `xs` | `4px` | 4 |
| `sm` | `8px` | 8 |
| `md` | `16px` | 16 |
| `lg` | `24px` | 24 |
| `xl` | `32px` | 32 |
| `gutter` | `24px` | 24 |
| `margin-mobile` | `16px` | 16 |
| `margin-desktop` | `48px` | 48 |

---

## Typography

**Font Family:** Inter (`'Inter', sans-serif`)

| Token | Size | Line | Weight | Tracking |
|---|---|---|---|---|
| `headline-xl` | 40px | 48px | 700 | -0.02em |
| `headline-lg` | 32px | 40px | 600 | -0.02em |
| `headline-lg-mobile` | 28px | 36px | 600 | -0.01em |
| `headline-md` | 24px | 32px | 600 | — |
| `body-lg` | 18px | 28px | 400 | — |
| `body-md` | 16px | 24px | 400 | — |
| `body-sm` | 14px | 20px | 400 | — |
| `label-md` | 14px | 16px | 600 | 0.05em |
| `label-sm` | 12px | 14px | 500 | — |

---

## Elevation (Surface Hierarchy)

Light → Dark (lowest elevation → highest):

| Level | Token | Hex |
|---|---|---|
| 0 | `surface-container-lowest` | `#ffffff` |
| 1 | `surface-container-low` | `#eff4ff` |
| 2 | `surface-container` | `#e5eeff` |
| 3 | `surface-container-high` | `#dce9ff` |
| 4 | `surface-container-highest` | `#d3e4fe` |

---

## Icons

**System:** Material Symbols Outlined  
**Variable font axis:** `'FILL' 0..1`, `'wght' 100..700`, `'GRAD' 0`, `'opsz' 24`

| Icon | Used In |
|---|---|
| `notifications` | Top bar |
| `error` | Emergency banner |
| `location_on` | Map pin, location card |
| `calendar_today` | Routine card |
| `wb_sunny` | Woke Up card |
| `restaurant` | Ate card |
| `medication` | Took Meds card |
| `bedtime` | Rested Well card |
| `volunteer_activism` | Helper Present card |
| `record_voice_over` | Voice Check-In card |
| `home` | Nav (active) |
| `history_toggle_off` | Nav |
| `sensors` | Nav |
| `person` | Nav |
| `call` | FAB |

---

## Motion

| Animation | Duration | Easing |
|---|---|---|
| `pulse-red` (alert dot) | 1.5s infinite | `cubic-bezier(0.4, 0, 0.6, 1)` |
| `blink-scale` (map pin) | 1.2s infinite | `ease-in-out` |
| `bounce` (emergency banner) | built-in | Tailwind `animate-bounce` |
| Card touch feedback | instant | `scale-[0.98]` on press |
| Nav/FAB press | 200ms | `transition-transform active:scale-90` |
| Hover color | instant | `transition-colors` |
