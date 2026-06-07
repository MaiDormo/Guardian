<!-- Generated: 2026-06-06 | Files scanned: 6 | Token estimate: ~450 -->

# Dependencies & Integrations

## On-device (zero cloud egress — the core privacy claim)

| Service | Used by | Notes |
|---|---|---|
| **Ollama** (host `:11434`) | `agent.py`, `baseline.py` | `OLLAMA_HOST` env; Docker → `host.docker.internal` |
| `gemma4:e4b` | `agent.py` | reasoning + tool-calling; `gemma4:2b` low-RAM fallback |
| `nomic-embed-text` | `baseline.py` | 768-dim embeddings; cosine pass-through on demo path |
| **SQLite + sqlite-vec** | `db.py`, `baseline.py` | single local file; native cosine vector search |

## Python backend — `backend/requirements.txt`

```
fastapi>=0.115          uvicorn[standard]>=0.30    sse-starlette>=2.1
apscheduler>=3.10       ollama>=0.4                httpx>=0.27
python-dotenv>=1.0      pydantic>=2.7
sqlite-vec>=0.1.6       numpy>=1.26                scikit-learn>=1.4
```

Dev: `backend/requirements-dev.txt` → `pytest pytest-asyncio httpx anyio`
Config: `pytest.ini` (`asyncio_mode=auto`, `testpaths=tests`)

## Frontend — `web/package.json`

```
next@15         react@19        react-dom@19
typescript      tailwindcss     autoprefixer    postcss
```

## External (optional, demo-safe if absent)

| Service | Route | Priority | Absent behaviour |
|---|---|---|---|
| **WeCom (企业微信) webhook** | `POST /trigger/intervention` | **PRIMARY** | falls through to WhatsApp if configured |
| **WeCom (企业微信) webhook** | `POST /trigger/connection` | **PRIMARY** | falls through to WhatsApp if configured |
| **WhatsApp Business API** | `POST /trigger/intervention` | FALLBACK | overlay still renders; `channel="overlay_only"` |
| **WhatsApp Business API** | `POST /trigger/connection` | FALLBACK | nudge skipped; still returns window result |

WeCom endpoint: `POST https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...`
(Free, 2-min setup, works in mainland China without VPN — group bot, no business registration.)
WhatsApp endpoint: `POST https://graph.facebook.com/v20.0/{WHATSAPP_PHONE_ID}/messages`
Auth: `Authorization: Bearer {WHATSAPP_TOKEN}`

## Environment variables

```bash
# Required
OLLAMA_HOST=http://localhost:11434       # docker: http://host.docker.internal:11434
DB_PATH=./guardian.db                   # docker: /app/db/guardian.db

# Optional — WeCom (PRIMARY dispatch, works in mainland China without VPN)
WECOM_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE

# Optional — WhatsApp Business API (FALLBACK, requires Meta business account)
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_ID=...
CAREGIVER_PHONE=+852XXXXXXXXXX

# Optional — misc
BACKEND_URL=http://localhost:8000        # radar_simulator.py target

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Docker — `docker-compose.yml`

```
backend  build: ./backend  ports: 8000  volume: guardian_db:/app/db
web      build: ./web      ports: 3000  depends_on: backend (healthcheck)
```
Ollama runs on **host**, not in compose. Only prerequisite: `ollama pull gemma4:e4b && ollama pull nomic-embed-text`.

## Prerequisites (setup target)

≥16GB RAM · `ollama pull gemma4:e4b && ollama pull nomic-embed-text` · `docker compose up` → :3000 in 90s.
