<!-- Generated: 2026-06-07 | Files scanned: 22 | Token estimate: ~800 -->

# Frontend — Next.js 14 App

`web/` — fully built and wired to SSE. Next.js 14, TailwindCSS, TypeScript.
API target: `NEXT_PUBLIC_API_URL` env → `http://localhost:8000`.

## Page tree

```
web/app/
  layout.tsx          root layout (fonts, body wrapper)
  globals.css         Tailwind base + custom CSS vars
  page.tsx            single-page app entry; owns all SSE state via useSSE();
                      h-dvh overflow-hidden fixed-viewport 3-column layout (PRD §10)
  lib/
    api.ts            apiUrl() helper — reads NEXT_PUBLIC_API_URL or defaults to localhost:8000
    useSSE.ts         SSE client hook — connects to GET /events, reconnects; 299 ln
    types.ts          TypeScript types for all SSE payload shapes; 110 ln
    signals.ts        SIGNAL_NAMES + display metadata; 59 ln
    signalValues.ts   human-readable label/icon/colour mappings per signal; 42 ln
    icons.tsx         SVG icon components; 26 ln
  components/
    Header.tsx             "Guardian" title + on-device badge wired to /status; 32 ln
    FallBanner.tsx         full-width red interrupt; dismiss button; 42 ln
    ZoneMap.tsx            2×2 semantic room grid (bedroom/bathroom/living_room/kitchen);
                           soft blue radar pulse on active node; bathroom goes red on fall; 87 ln
    LocationMap.tsx        SVG GBA trajectory heatmap; opacity toggle on wandering_detected; 138 ln
    ConnectionCard.tsx     Optimal Connection Window — best-call hour, avg voice clarity,
                           on-device LLM advice, WeCom/WhatsApp nudge trigger; 110 ln
    SignalGrid.tsx         8-card responsive grid; 38 ln
    SignalCard.tsx         colour state chip (green/amber/red/unknown), expandable reasoning; 61 ln
    ReasoningPanel.tsx     per-signal cosine distance + rationale log; persistent right column; 85 ln
    InterventionTrigger.tsx POST /trigger/intervention + overlay; 96 ln
    ScenarioPlayer.tsx     3 scenario buttons → POST /scenario/{name}; 66 ln
    BottomNav.tsx          mobile bottom nav — present in repo but NOT imported by page.tsx; 33 ln
    Fab.tsx                floating action button — present in repo but NOT imported by page.tsx; 62 ln
```

## State flow

```
useSSE() → SSEState {
  signals:         Record<SignalName, SignalStateData>   ← signal_update
  presence:        Record<Room, PresencePayload>         ← presence_update
  location:        LocationUpdatePayload | null          ← location_update
  wandering:       WanderingPayload | null               ← wandering_detected
  fall:            FallPayload | null                    ← fall_detected
  reasoning:       ReasoningPayload[]  (last 20)         ← reasoning_update
  interventionAck: InterventionAckPayload | null         ← intervention_ack
  connectionWindow: ConnectionWindowPayload | null       ← connection_window
  connectionAck:   ConnectionAckPayload | null           ← connection_ack
  scenarioActive:  string | null                        ← state_reset
  backendConnected: boolean                             ← SSE open/error
}
```

All state lives in `page.tsx` via the `sse` object. Components receive slices as props.
`state_reset` event clears all state and resets to `createEmptyState()`.
On mount, `createDemoState()` pre-seeds all 8 signals green so judges see a populated
dashboard before any scenario runs.

## SSE consumption map

```
signal_update      → SignalGrid → SignalCard (colour chip + expandable reasoning)
presence_update    → ZoneMap (active room node pulse)
location_update    → LocationMap (density score + distance from home)
wandering_detected → LocationMap (toggles anomalous-trace opacity)
fall_detected      → FallBanner (fixed full-width top banner, dismiss button)
reasoning_update   → ReasoningPanel (right column) + SignalCard (expandable)
intervention_ack   → InterventionTrigger (centered overlay)
connection_window  → ConnectionCard (best-call hour, voice clarity, advice)
connection_ack     → ConnectionCard (WeCom/WhatsApp nudge confirmation)
state_reset        → page.tsx resets all state to createEmptyState()
ping               → ignored
```

## Layout — fixed viewport (PRD §10, §12)

```
<main class="flex h-dvh flex-col gap-3 overflow-hidden">
  <Header />                          ← top bar
  [<FallBanner />]                    ← conditional, above grid
  <div class="grid grid-cols-12">
    col-span-3  LocationMap + ZoneMap
    col-span-6  ConnectionCard + SignalGrid + ScenarioPlayer
    col-span-3  InterventionTrigger + ReasoningPanel
  </div>
</main>
```

No scroll at any viewport — all columns use `min-h-0 flex-1` to fill available height.

## Intervention flow

```
InterventionTrigger button click
  → POST /trigger/intervention {}
  → overlay renders immediately (<500ms — no network wait)
  → intervention_ack SSE arrives: channel = "wecom" | "whatsapp" | "overlay_only"
  → overlay label updates with actual dispatch channel
```

## Config files

```
web/next.config.js        Next.js config
web/tailwind.config.js    TailwindCSS — custom design tokens (bg-console, margin-mobile, etc.)
web/tsconfig.json         TypeScript strict mode
web/package.json          next, react, react-dom, typescript, tailwindcss, autoprefixer
web/.env.local            NEXT_PUBLIC_API_URL=http://localhost:8000
web/Dockerfile            node:20-alpine, npm run build, npm start
```
