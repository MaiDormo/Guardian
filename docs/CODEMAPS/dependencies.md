<!-- Generated: 2026-06-07 | Files scanned: 7 | Token estimate: ~480 -->

# Dependencies & Integrations

## On-device (zero cloud egress)

| Service | Used by | Notes |
|---|---|---|
| **Ollama** (host `:11434`) | `agent.py`, `baseline.py` | `OLLAMA_HOST` env |
| `gemma4:e4b` | `agent.py` | reasoning + tool-calling |
| `nomic-embed-text` | `baseline.py` | 768-dim embeddings |
| **SQLite + sqlite-vec** | `db.py`, `baseline.py` | single local file |

## Python backend — `backend/requirements.txt`

```
fastapi>=0.115  uvicorn[standard]>=0.30  sse-starlette>=2.1  apscheduler>=3.10
ollama>=0.4  httpx>=0.27  python-dotenv>=1.0  pydantic>=2.7
sqlite-vec>=0.1.6  numpy>=1.26  scikit-learn>=1.4
```

Dev: `backend/requirements-dev.txt` → `pytest pytest-asyncio httpx anyio pytest-cov>=5.0`
Config: `pytest.ini` (`asyncio_mode=auto`, `testpaths=backend/tests`)

## Frontend — `web/package.json`

```
next@15  react@19  react-dom@19  typescript  tailwindcss
```

## External (optional, demo-safe if absent)

| Service | Route | Absent behaviour |
|---|---|---|
| **WeCom webhook** | `/trigger/intervention`, `/trigger/connection` | falls through to WhatsApp |
| **WhatsApp Business API** | same | `channel="overlay_only"` |

## Environment variables (`.env.example`)

```
OLLAMA_HOST  DB_PATH  BACKEND_URL
WECOM_WEBHOOK_URL  WHATSAPP_TOKEN  WHATSAPP_PHONE_ID  CAREGIVER_PHONE  (optional)
NEXT_PUBLIC_API_URL  (frontend)
```

No `MQTT_BROKER` — hardware MQTT is design-time only (`hardware/README.md`).

## Docker — `docker-compose.yml`

```
backend :8000  web :3000  volume guardian_db
```
Ollama on host: `ollama pull gemma4:e4b && ollama pull nomic-embed-text`
