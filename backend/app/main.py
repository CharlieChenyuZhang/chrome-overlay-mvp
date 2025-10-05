import asyncio
import json
import time
import uuid
import os
from dotenv import load_dotenv
from typing import Any, AsyncGenerator, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import httpx


class RunState:
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    DONE = "done"


class Run:
    def __init__(self, task: str) -> None:
        self.id: str = str(uuid.uuid4())
        self.task: str = task
        self.state: str = RunState.RUNNING
        self.created_at: float = time.time()
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._status_queue: asyncio.Queue[str] = asyncio.Queue()
        self._worker: Optional[asyncio.Task[Any]] = None

    async def log(self, message: str) -> None:
        await self._queue.put(json.dumps({"type": "log", "message": message}))

    async def chat(self, role: str, content: str) -> None:
        payload = json.dumps({
            "type": "chat",
            "message": {
                "role": role,
                "content": content
            }
        })
        await self._queue.put(payload)

    async def set_state(self, next_state: str) -> None:
        self.state = next_state
        await self._status_queue.put(json.dumps({"state": self.state}))


runs: Dict[str, Run] = {}

# Load .env once at startup
load_dotenv()

app = FastAPI(title="Overlay Backend API", version="0.0.1")

# CORS: during development we allow all origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def sse_event(data: str, event: Optional[str] = None) -> str:
    lines = []
    if event:
        lines.append(f"event: {event}")
    for line in data.splitlines():
        lines.append(f"data: {line}")
    lines.append("")
    return "\n".join(lines) + "\n"


async def run_worker(run: Run) -> None:
    try:
        await run.log("Worker started")
        await run.chat("assistant", f"Starting task: {run.task}")
        steps = [
            "Analyzing the page…",
            "Planning actions…",
            "Executing step 1…",
            "Executing step 2…",
            "Finalizing…",
        ]
        for step in steps:
            # Pause loop
            while run.state == RunState.PAUSED:
                await asyncio.sleep(0.2)
            if run.state in (RunState.STOPPED, RunState.DONE):
                break
            await run.log(step)
            await asyncio.sleep(0.8)

        if run.state not in (RunState.STOPPED,):
            await run.chat("assistant", "Task completed successfully.")
            await run.set_state(RunState.DONE)
            await run.log("Worker finished")
    except asyncio.CancelledError:
        # Propagate cancellation
        raise
    except Exception as e:
        await run.log(f"Worker error: {e}")
        await run.set_state("error")


@app.post("/api/agent/start")
async def start_agent(payload: Dict[str, Any]) -> Dict[str, Any]:
    task = str(payload.get("task") or "")
    if not task:
        raise HTTPException(status_code=400, detail="task is required")
    run = Run(task=task)
    runs[run.id] = run
    await run.set_state(RunState.RUNNING)
    run._worker = asyncio.create_task(run_worker(run))
    return {"runId": run.id}


@app.post("/api/agent/pause")
async def pause_agent(payload: Dict[str, Any]) -> Dict[str, Any]:
    run_id = str(payload.get("runId") or "")
    run = runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    await run.set_state(RunState.PAUSED)
    await run.log("Paused by user")
    return {"ok": True}


@app.post("/api/agent/resume")
async def resume_agent(payload: Dict[str, Any]) -> Dict[str, Any]:
    run_id = str(payload.get("runId") or "")
    run = runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    await run.set_state(RunState.RUNNING)
    await run.log("Resumed by user")
    return {"ok": True}


@app.post("/api/agent/stop")
async def stop_agent(payload: Dict[str, Any]) -> Dict[str, Any]:
    run_id = str(payload.get("runId") or "")
    run = runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    await run.set_state(RunState.STOPPED)
    await run.log("Stopped by user")
    if run._worker and not run._worker.done():
        run._worker.cancel()
        try:
            await run._worker
        except asyncio.CancelledError:
            pass
    return {"ok": True}


@app.get("/api/agent/stream")
async def stream_agent(runId: str, request: Request) -> StreamingResponse:
    run = runs.get(runId)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")

    async def event_generator() -> AsyncGenerator[bytes, None]:
        status_queue = run._status_queue
        queue = run._queue
        # Send initial status
        yield (await sse_event(json.dumps({"state": run.state}), event="status")).encode()
        try:
            while True:
                if await request.is_disconnected():
                    break
                # Prefer status messages first to keep UI state fresh
                try:
                    status_msg = status_queue.get_nowait()
                    yield (await sse_event(status_msg, event="status")).encode()
                    continue
                except asyncio.QueueEmpty:
                    pass

                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=0.5)
                    yield (await sse_event(msg)).encode()
                except asyncio.TimeoutError:
                    # Periodic heartbeat to keep connection alive
                    yield (await sse_event(json.dumps({"type": "ping", "t": time.time()}))).encode()
        finally:
            # On disconnect, do nothing special
            ...

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/")
async def root() -> Dict[str, Any]:
    return {"ok": True, "service": "overlay-backend", "version": "0.0.1"}


# ---------- Analysis endpoint (DOM + screenshots -> GPT suggestions) ----------

class Screenshot(BaseModel):
    mime_type: str = Field(..., description="e.g., image/png or image/jpeg")
    data_base64: str = Field(..., description="Base64-encoded image data (no data URI prefix)")


class AnalysisRequest(BaseModel):
    page_url: Optional[str] = None
    dom_html: str
    screenshots: List[Screenshot] = Field(default_factory=list)
    user_prompt: Optional[str] = Field(default=None, description="Optional instruction or question from the user")


class Suggestion(BaseModel):
    description: str
    actions: List[str] = Field(default_factory=list)


class AnalysisResponse(BaseModel):
    suggestions: List[Suggestion]
    model: str
    usage_tokens: Optional[int] = None


def get_gpt_settings() -> Dict[str, str]:
    return {
        "api_key": os.getenv("OPENAI_API_KEY", ""),
        "base_url": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        "model": os.getenv("OPENAI_MODEL", "gpt-5"),
    }


async def call_gpt_api(payload: Dict[str, Any]) -> Dict[str, Any]:
    settings = get_gpt_settings()
    api_key = settings["api_key"]
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    url = f"{settings['base_url'].rstrip('/')}/responses"
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()


def build_input_text(req: AnalysisRequest) -> str:
    system_prompt = (
        "You are a UI assistant. Given raw DOM, analyze the page state and "
        "propose specific, safe UI actions. Return a concise bullet list of "
        "actions with rationale."
    )

    max_dom_chars = 120000
    dom_excerpt = req.dom_html[:max_dom_chars]
    user_prompt = req.user_prompt or "Please analyze this page and suggest next UI actions."

    parts: List[str] = [
        f"[SYSTEM]\n{system_prompt}",
        f"[URL]\n{req.page_url or 'unknown'}",
        f"[INSTRUCTION]\n{user_prompt}",
        "[DOM_TRUNCATED]",
        dom_excerpt,
    ]
    # Note: screenshots omitted in text mode to maximize compatibility
    return "\n\n".join(parts)


def build_input_blocks(req: AnalysisRequest) -> List[Dict[str, Any]]:
    system_prompt = (
        "You are a UI assistant. Given raw DOM and one or more screenshots, "
        "analyze the page state and propose specific, safe UI actions. Return "
        "a concise bullet list of actions with rationale."
    )

    blocks: List[Dict[str, Any]] = [
        {"type": "text", "text": f"[SYSTEM]\n{system_prompt}"},
        {"type": "text", "text": f"[URL]\n{req.page_url or 'unknown'}"},
        {"type": "text", "text": (req.user_prompt or "Please analyze this page and suggest next UI actions.")},
    ]

    # Attach DOM content (truncate to keep payload reasonable)
    max_dom_chars = 120000
    dom_excerpt = req.dom_html[:max_dom_chars]
    blocks.append({"type": "text", "text": f"[DOM_TRUNCATED]\n{dom_excerpt}"})

    # Attach screenshots as image blocks if provided (multimodal)
    for s in req.screenshots:
        ext = s.mime_type.split("/")[-1] if "/" in s.mime_type else "png"
        blocks.append({"type": "text", "text": "[SCREENSHOT]"})
        blocks.append({
            "type": "input_image",
            "image": {
                "format": ext,
                "b64_data": s.data_base64,
            },
        })

    return blocks


@app.post("/api/analysis", response_model=AnalysisResponse)
async def analyze_page(req: AnalysisRequest) -> AnalysisResponse:
    settings = get_gpt_settings()
    # Prefer multimodal when screenshots provided; fallback to text-only on 400
    use_blocks = len(req.screenshots) > 0
    data: Dict[str, Any]
    try:
        if use_blocks:
            payload_blocks = {
                "model": settings["model"],
                "input": build_input_blocks(req),
                "reasoning": {"effort": "minimal"},
                "text": {"verbosity": "low"},
                "max_output_tokens": 800,
            }
            data = await call_gpt_api(payload_blocks)
        else:
            raise HTTPException(status_code=599, detail="skip-to-text")
    except HTTPException as he:
        if he.status_code in (400, 415, 422, 599):
            input_text = build_input_text(req)
            payload_text = {
                "model": settings["model"],
                "input": input_text,
                "reasoning": {"effort": "minimal"},
                "text": {"verbosity": "low"},
                "max_output_tokens": 800,
            }
            data = await call_gpt_api(payload_text)
        else:
            raise

    # Extract text from Responses API
    text = ""
    usage_tokens: Optional[int] = None
    try:
        # Try SDK-like output_text if present
        text = data.get("output_text") or ""
    except Exception:
        text = ""
    if not text:
        # Fallback: concatenate output items or raw data
        try:
            if isinstance(data.get("output"), list):
                parts: List[str] = []
                for item in data["output"]:
                    if item.get("type") == "message":
                        # message may contain array of content parts
                        for c in item.get("content", []):
                            if c.get("type") == "output_text" and "text" in c:
                                parts.append(str(c["text"]))
                    elif item.get("type") == "output_text" and "text" in item:
                        parts.append(str(item["text"]))
                text = "\n".join([p for p in parts if p])
        except Exception:
            text = ""
    try:
        usage_tokens = int(data.get("usage", {}).get("total_tokens"))
    except Exception:
        usage_tokens = None

    # Very light parsing: split into bullet-like suggestions
    lines = [l.strip(" -•\t") for l in text.splitlines() if l.strip()]
    suggestions = [Suggestion(description=l, actions=[]) for l in lines[:10]]

    return AnalysisResponse(suggestions=suggestions, model=settings["model"], usage_tokens=usage_tokens)


