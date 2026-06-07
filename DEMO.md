# Guardian — Stage Demo Script

**Runtime:** ~2 minutes  
**URL:** http://localhost:3000  
**Presenter:** Eleoner (or any operator reading this verbatim)

This file is the **source of truth** for stage choreography. Button labels, timings, and UI states match the running app. The spoken lines below are the finalized human-centric pitch; the UI handles the technical heavy lifting automatically.

---

## Pre-flight (5 minutes before)

```bash
# 1. Ollama on host (optional — cached reasoning works without it)
ollama pull gemma4:e4b
ollama pull nomic-embed-text

# 2. Start stack
cp .env.example .env   # first time only
docker compose up --build -d
```

**Checklist**

- [ ] Browser at **≥1024px width** (desktop 3-column layout)
- [ ] Top-right badge shows **Live · SSE** (green); on wide screens also shows *Running On-Device*
- [ ] Set `WECOM_WEBHOOK_URL` in `.env` if you want a live phone chime on dispatch
- [ ] Run **Normal Morning** once before judges arrive to confirm signals stream in over ~11s
- [ ] Close extra tabs; mute notifications except demo phone

**Critical timing:** Press **7-Day Trend** and **keep talking** — amber lands at ~3s, four reds at ~15s (**11s narration beat** between amber and red). Do **not** press **Dispatch** until those reds appear and the button highlights.

---

## Dashboard map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Ah-Ma · Shenzhen                    [● Live · SSE · On-Device]            │
├──────────────┬──────────────────────────────────────┬───────────────────────┤
│ LEFT         │ CENTER                               │ RIGHT                 │
│ Daily Route  │ Optimal Connection Window            │ Dispatch Local        │
│ Check        │                                      │ Emergency Care        │
│ Abstract     │ Vital Signals (8 cards)              │ Reasoning Console     │
│ Zone Map     │                                      │                       │
│              │ DEMO ENGINE                          │                       │
│              │ [Normal Morning] [7-Day Trend]       │                       │
│              │ [Fall Override]                      │                       │
└──────────────┴──────────────────────────────────────┴───────────────────────┘
```

**Fall banner** — full-width red bar across the top when Fall Override fires.

---

## Button reference

| Button | What it does | Wall time |
|--------|--------------|-----------|
| **▶ Normal Morning** | Clears cards to blank, then streams eight greens over ~11s as radar/voice events arrive. Zone map animates bedroom → bathroom → kitchen. Connection Window + reasoning at ~11s. | ~11s |
| **▶ 7-Day Trend** | 7-day drift compressed for stage. Day 5 (~3s): voice amber. Day 7 (~15s): Voice, Location, Routine, Took Meds red. Dispatch button highlights. | ~16s |
| **▶ Fall Override** | Hard cut — bathroom fall, banner, chime, auto-dispatch. Safety-reflex tier bypasses agent loop for the alert itself; console still logs priority interrupt. | Instant |
| **Dispatch Local Emergency Care** | WeCom → WhatsApp → overlay fallback. Always shows success overlay. | <1s |
| **Send call nudge** (Connection Window) | Optional — gentle call reminder. Not part of main script. | — |

---

## The 2-Minute Script (Final Stage Version)

### Act 1 — The Ambient Baseline (0:00–0:30)

**Press:** ▶ **Normal Morning**

**Watch:**

- Vital Signals: eight cards start **blank (—)**, then flip **green one-by-one** over ~11s
- Abstract Zone Map: bedroom → bathroom → kitchen pulse blue over ~11s
- Optimal Connection Window: **15:00–16:00** appears at ~11s with reasoning

**Say:**

> "My Ah-Ma lives alone in the Greater Bay Area while I work in Hong Kong. I used to call her every morning just to make sure she was okay—but she doesn't always pick up, and that silence is terrifying.
>
> Guardian monitors her safety without robbing her of her dignity. We install small, ceiling-mounted radar sensors around her home. No cameras, no microphones. It reads presence, breathing, and routine inside, while a secure stream tracks her path outside.
>
> Because it learns her daily rhythm, it doesn't just look for emergencies. It tells me that 3:00 PM is her most alert window, giving me the perfect moment to just call and say hi."

---

### Act 2 — The Multi-Modal Drift (0:30–1:15)

**Press:** ▶ **7-Day Trend**

**Watch & Pace:** Scenario runs **~16 seconds** — narrate continuously; the UI keeps pace. Point at the amber card when you say "flagged amber here" (~3s). You have **~11 seconds** before four cards slam red as you reach "Day 7" (~15s).

**Say:**

> "We don't wait for a crisis. Watch what happens if her patterns drift over a week.
>
> On Days 1 through 4, she stays within her normal routine. By Day 5, we see a mild drop in voice clarity—flagged amber here. Nothing critical yet, but the system is watching.
>
> Day 7. She misses a meal, her voice sounds confused on her daily check-in, and her walk takes her somewhere she has never been. Guardian catches the convergence of these signals and notifies me before it becomes a crisis."

**Press:** **Dispatch Local Emergency Care**

**Watch:**

- Spinner → green checkmark
- Overlay: *"Alert dispatched — Shenzhen Care Network notified"*

**Say:**

> "With one button, I can send her live location and the AI's summary directly to a local caregiver in Shenzhen."

*[Team phone chimes if WeCom webhook is configured.]*

---

### Act 3 — Bridge (1:15–1:40)

**Say (no button):**

> "But what if the drift happens in seconds, not days?"

---

### Act 4 — The Hard Cut (1:40–1:50)

**Press:** ▶ **Fall Override**

**Watch:**

- Bathroom node on Zone Map pulses violent red
- **FALL DETECTED** banner + alert chime
- Auto-dispatch fires

**Say:**

> "If she falls, the system executes an immediate, deterministic safety reflex. It bypasses the AI completely to send an alarm instantly, so I can call for an ambulance."

---

### Act 5 — The Close (1:50–2:00)

**Action:** Toggle **Airplane Mode** from the OS menu bar. Point at the green **Live · SSE** badge (wide layout also shows *Running On-Device*).

**Say:**

> "To protect her, we made a strict architectural choice: all of this reasoning runs locally on this laptop. No cloud. No footage leaked.
>
> She never even knows it's watching—letting me go about my day with peace of mind I can actually trust. Thank you."

---

## Operator sync notes (not spoken)

These are the automatic UI events behind each act — use for rehearsal, not for the audience.

| Act | ~Time | Automatic UI event |
|-----|-------|-------------------|
| 1 | 0s | All eight signal cards **green**; Connection Window shows `15:00-16:00` |
| 1 | 0–11s | Zone map animates bedroom → bathroom → kitchen |
| 1 | ~11s | Reasoning Console logs routine baseline (*"Baseline deviation: 0.04"*) |
| 2 | ~3s | Voice Check-In card turns **amber** (clarity 0.68) — point here while narrating Day 5 |
| 2 | ~15s | Voice, Location, Routine, Took Meds turn **red**; Dispatch button highlights; **Daily Route Check** (left): static red path draws once, "34 min outside" chip, footer **9% match** (not Learning) |
| 2 | on dispatch | Overlay: *Alert dispatched — Shenzhen Care Network notified* |
| 4 | instant | Fall banner + chime; auto-dispatch; Reasoning Console: *Priority interrupt — … bypassed the agent loop by design* |
| 5 | — | Airplane Mode off/on: local SSE to `localhost:8000` stays connected — proves on-device, no cloud |

---

## Reasoning Console — gesture cues (not spoken)

The right column shows a **simplified demo log** (dot + bold stat + short rationale). Point at it briefly — do not read it aloud.

| Act | ~Time | Gesture |
|-----|-------|---------|
| 1 Normal Morning | ~11s | **Point right:** "See the green log — 4% off her usual morning routine" |
| 2 7-Day Trend | ~3s | **Point right:** amber dot on voice entry while narrating Day 5 |
| 2 7-Day Trend | ~15s | **Point right:** red entries as four signal cards slam red |
| 4 Fall Override | instant | Console shows priority interrupt (agent loop bypassed) |
| 5 Close | — | Console footer reads **On-device reasoning**; header badge shows on-device |

Full technical XML view (for Devpost screenshots only): rebuild web with `NEXT_PUBLIC_REASONING_DEMO_MODE=false`.

---

## Q&A cheat sheet (not spoken)

- **Scenarios** are choreographed timelines; reasoning is **cached Gemma 4 output** served locally (see `backend/agent.py`).
- **Signal colors** come from deterministic `signals.py`, not the LLM.
- **"Is this scripted?"** → "The sensor input is simulated; the pipeline, baseline math, and on-device inference are real. Happy to show airplane mode." (See `HONESTY.md`.)

---

## Expected signal states (ground truth)

| Signal | Normal Morning | 7-Day Trend (Day 7) | Fall Override |
|--------|----------------|---------------------|---------------|
| Woke Up | 🟢 | 🟢 | — |
| Ate | 🟢 | 🟡 (kitchen dwell drop) | — |
| Took Meds | 🟢 | 🔴 (missed dose) | — |
| Rested Well | 🟢 | — (not in scenario) | — |
| Helper Present | 🟢 | — (not in scenario) | — |
| Voice Check-In | 🟢 | 🔴 (Day 5: 🟡 amber first) | — |
| Location | 🟢 | 🔴 | — |
| Routine | 🟢 | 🔴 | — |
| Fall | — | — | 🚨 banner |

**Day 7 red cards to call out:** Voice Check-In, Location, Routine, Took Meds (four reds — expected, not a bug).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Badge says **Stream offline** or **Reconnecting…** | `docker compose ps` — ensure backend healthy. Refresh page. |
| 7-Day Trend stuck on green | Wait **~16s** while narrating. Re-press button (replay clears dedup automatically). |
| Dispatch button never highlights | Wait until all four crisis signals are red (~15s). Do not rely on scenario name alone. |
| No reasoning in console | Start `ollama serve` — cached reasoning still serves scripted scenarios without it. |
| No phone chime on dispatch | Set `WECOM_WEBHOOK_URL` in `.env`, rebuild backend. Overlay always works without it. |
| Layout looks stacked | Widen browser to ≥1024px or fullscreen. |
| Airplane Mode drops badge | Localhost SSE should survive; if badge flickers, wait 2s — it reconnects to `localhost:8000`. |

---

## Verification (rehearsal)

```bash
cd backend && python3 -m pytest -q
cd ../web && npm test && npm run build
docker compose up --build -d
curl -X POST http://localhost:8000/scenario/normal && sleep 12    # 0.04 console at ~11s
curl -X POST http://localhost:8000/scenario/trend_7day && sleep 4   # voice amber ~3s
curl -s http://localhost:8000/status | python3 -c "import sys,json; s=json.load(sys.stdin)['signals']; print('reds:', [k for k,v in s.items() if v['state']=='red'])"  # after ~16s
curl -X POST http://localhost:8000/scenario/fall                  # priority interrupt console
```

---

## Quick re-run order

1. Normal Morning (~11s)
2. 7-Day Trend (~16s) → narrate through → Dispatch when reds land (~15s)
3. Fall Override (instant)
4. Airplane Mode toggle (Act 5 close)
