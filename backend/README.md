### Backend (FastAPI) - Overlay Agent API

Run a local API that the Chrome extension talks to.

#### Setup

```bash
# (optional) create venv
python3 -m venv .venv
source .venv/bin/activate

# install deps
pip install -r backend/requirements.txt
```

#### Run

```bash
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 7788
```

- Root: GET `/` -> health JSON
- Agent endpoints:
  - POST `/api/agent/start` -> `{ runId }`
  - POST `/api/agent/pause` -> `{ ok: true }`
  - POST `/api/agent/resume` -> `{ ok: true }`
  - POST `/api/agent/stop` -> `{ ok: true }`
  - GET `/api/agent/stream?runId=...` -> Server-Sent Events stream

Make sure the extension `baseUrl` is `http://127.0.0.1:7788` (default in `sidepanel.tsx`) or set it in the side panel inputs.

### Endpoints (simple)

- `GET /` — Health check; returns service/version.
- `POST /api/agent/start` — Starts a run; returns `{ runId }`.
- `POST /api/agent/pause` — Pauses a run; body `{ runId }`.
- `POST /api/agent/resume` — Resumes a run; body `{ runId }`.
- `POST /api/agent/stop` — Stops a run; body `{ runId }`.
- `GET /api/agent/stream?runId=...` — SSE stream of logs/status for a run.
- `POST /api/analysis` — Send DOM + screenshots for GPT-5 analysis; returns suggestions.

#### New: Analysis API (DOM + screenshots)

POST `/api/analysis`

Request JSON:

```json
{
  "page_url": "https://example.com",
  "dom_html": "<html>... raw DOM ...</html>",
  "screenshots": [
    { "mime_type": "image/png", "data_base64": "iVBORw0KGgoAAA..." }
  ],
  "user_prompt": "Find actionable next steps"
}
```

Response JSON (example):

```json
{
  "suggestions": [
    { "description": "Click the Sign in button", "actions": [] },
    { "description": "Open the profile menu", "actions": [] }
  ],
  "model": "gpt-5",
  "usage_tokens": 1234
}
```

Environment variables:

- `OPENAI_API_KEY` (required)
- `OPENAI_BASE_URL` (optional, default `https://api.openai.com/v1`)
- `OPENAI_MODEL` (optional, default `gpt-5`)
