<!-- Generated: 2026-06-07 | Files scanned: 20 | Token estimate: ~750 -->

# Frontend — Next.js 14 App

`web/` — fully built and wired to SSE. Next.js 14, TailwindCSS, TypeScript.
API target: `NEXT_PUBLIC_API_URL` env → `http://localhost:8000`.

## Page tree

```
web/app/
  layout.tsx          root layout (fonts, body wrapper)
  globals.css         Tailwind base + custom CSS vars
  page.tsx            single-page app entry; owns all SSE state via useSSE(), implements PRD 3-column layout
  lib/
    useSSE.ts         SSE client hook — connects to GET /events, handles reconnect
    types.ts          TypeScript types for all SSE payload shapes
    signals.ts        SIGNAL_NAMES constant array + display metadata
    signalValues.ts   human-readable label/icon/colour mappings per signal
    icons.tsx         SVG icon components
  components/
    Header.tsx        "Guardian" title + on-device badge (22 ln)
    FallBanner.tsx    full-width red interrupt; dismiss button (36 ln)
    LocationMap.tsx   SVG heatmap; CSS opacity toggle on wandering (128 ln)
    FloorPlan.tsx     interactive SVG floor plan showing active room presence and fall pulsing (49 ln)
    ConnectionCard.tsx displays ideal overlap call window, average voice clarity, and LLM advice (142 ln)
    SignalGrid.tsx    8-card responsive grid
    SignalCard.tsx    colour state chip (expandable on mobile)
    ReasoningPanel.tsx per-signal cosine distance + rationale log (persistent right column on desktop)
    InterventionTrigger.tsx POST /trigger/intervention + overlay (right column)
    ScenarioPlayer.tsx 3 scenario buttons → POST /scenario/{name}
    BottomNav.tsx     mobile bottom navigation (hidden on desktop)
    Fab.tsx           floating action button (hidden on desktop)
  public/.gitkeep
```

## State flow

```
useSSE() → SSEState {
  signals:    Record<SignalName, SignalStateData>   ← signal_update
  presence:   Record<Room, PresencePayload>         ← presence_update
  location:   LocationUpdatePayload | null          ← location_update
  wandering:  WanderingPayload | null               ← wandering_detected
  fall:       FallPayload | null                    ← fall_detected
  reasoning:  ReasoningPayload[]  (last 20)         ← reasoning_update
  interventionAck: InterventionAckPayload | null    ← intervention_ack
  scenarioActive:  string | null                    ← state_reset
}
```
All state lives in `page.tsx` via the `sse` object. Components receive slices as props.
`state_reset` event clears all state and resets to demo initial green state.

## SSE consumption map

```
signal_update      → SignalGrid → SignalCard (colour chip)
presence_update    → FloorPlan (renders active room occupancy and fall alerts)
location_update    → LocationMap (density score + distance)
wandering_detected → LocationMap (toggles anomalous-trace opacity)
fall_detected      → FallBanner (fixed full-width top banner, dismiss button)
reasoning_update   → ReasoningPanel (persistent right column) and SignalCard (expandable)
intervention_ack   → InterventionTrigger (centered overlay on desktop) and Fab (toast on mobile)
connection_window  → ConnectionCard (displays best time to call + reasoning)
connection_ack     → ConnectionCard (displays WeCom/WhatsApp nudge status)
state_reset        → page.tsx clears all state to INITIAL_STATE
ping               → ignored
```

## Intervention flow

```
InterventionTrigger button click (desktop) or Fab button click (mobile)
  → POST /trigger/intervention {signal_summary, location}
  → centered overlay or toast renders in <500ms (setFabDispatched=true immediately)
  → intervention_ack SSE updates channel label: "wecom" | "whatsapp" | "overlay_only"
```

## Demo initial state

`useSSE.ts:demoInitialState()` — all 8 signals pre-seeded green with human-readable reasons
so judges see a populated dashboard before any scenario runs.

## Config files

```
web/next.config.js        (Next.js config)
web/tailwind.config.js    (TailwindCSS config)
web/tsconfig.json         (TypeScript strict mode)
web/package.json          next, react, react-dom, typescript, tailwindcss, autoprefixer
web/.env.local            NEXT_PUBLIC_API_URL=http://localhost:8000
web/Dockerfile            node:20-alpine, npm run build, npm start
```
