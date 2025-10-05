import { useEffect, useRef, useState } from "react"

function SidePanel() {
  const [isOverlayActive, setIsOverlayActive] = useState(false)
  const [taskText, setTaskText] = useState("")
  const [runId, setRunId] = useState<string | null>(null)
  const [status, setStatus] = useState<
    "idle" | "running" | "paused" | "stopped" | "done" | "error"
  >("idle")
  const [logs, setLogs] = useState<string[]>([])
  const [baseUrl, setBaseUrl] = useState<string>("http://127.0.0.1:7788")
  const [llmInfo, setLlmInfo] = useState<string>("LLM: OpenAI (default)")
  const [token, setToken] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    chrome.storage?.local?.get(["apiBaseUrl", "apiToken"], (res) => {
      if (res?.apiBaseUrl) setBaseUrl(res.apiBaseUrl)
      if (res?.apiToken) setToken(res.apiToken)
    })
  }, [])

  const saveConfig = (nextBaseUrl: string, nextToken: string | null) => {
    chrome.storage?.local?.set({
      apiBaseUrl: nextBaseUrl,
      apiToken: nextToken || ""
    })
  }

  const appendLog = (line: string) => setLogs((prev) => [...prev, line])

  const closeStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }

  const openStream = (rid: string) => {
    try {
      closeStream()
      const url = `${baseUrl}/api/agent/stream?runId=${encodeURIComponent(rid)}`
      const es = new EventSource(url, { withCredentials: false })
      eventSourceRef.current = es
      es.onmessage = (ev) => {
        if (!ev?.data) return
        try {
          const payload = JSON.parse(ev.data)
          if (payload?.type === "chat" && payload?.message) {
            const role = payload.message.role || "assistant"
            const content = payload.message.content || ""
            // Render markdown-lite: strip tags from WebUI JSON block wrapper if present
            const text =
              typeof content === "string" ? content : JSON.stringify(content)
            appendLog(`${role}: ${text}`)
          } else if (payload?.type === "log") {
            appendLog(String(payload.message))
          } else {
            appendLog(ev.data)
          }
        } catch {
          appendLog(ev.data)
        }
      }
      es.addEventListener("status", (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data)
          if (data?.state) setStatus(data.state)
        } catch {}
      })
      es.onerror = () => {
        appendLog("[stream] error or disconnected")
      }
    } catch (e) {
      appendLog(`[stream] failed: ${String(e)}`)
    }
  }

  const callApi = async (path: string, body?: unknown) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    }
    if (token) headers["Authorization"] = `Bearer ${token}`
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return (await res.json()) as any
  }

  const handleTakeOver = async () => {
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (tab?.id) {
        console.log("Sending SHOW_OVERLAY message to tab:", tab.id)
        // Send message to content script to show overlay
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "SHOW_OVERLAY"
        })
        console.log("Response from content script:", response)
        setIsOverlayActive(true)
      } else {
        console.warn("No active tab found")
      }
    } catch (error) {
      console.error("Error sending message to content script:", error)
      // Try to reload the page to inject the content script
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true
        })
        if (tab?.id) {
          await chrome.tabs.reload(tab.id)
          // Wait a bit and try again
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id, { type: "SHOW_OVERLAY" })
              setIsOverlayActive(true)
            } catch (retryError) {
              console.error("Retry failed:", retryError)
            }
          }, 1000)
        }
      } catch (reloadError) {
        console.error("Failed to reload tab:", reloadError)
      }
    }
  }

  const handleReclaimControl = async () => {
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (tab?.id) {
        console.log("Sending HIDE_OVERLAY message to tab:", tab.id)
        // Send message to content script to hide overlay
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "HIDE_OVERLAY"
        })
        console.log("Response from content script:", response)
        setIsOverlayActive(false)
      } else {
        console.warn("No active tab found")
      }
    } catch (error) {
      console.error("Error sending message to content script:", error)
      // Still set the state to false even if message fails
      setIsOverlayActive(false)
    }
  }

  const handleSubmitTask = async () => {
    try {
      setStatus("running")
      appendLog(`Submitting task...`)
      const resp = await callApi("/api/agent/start", { task: taskText })
      const rid = resp?.runId as string
      setRunId(rid)
      appendLog(`Run started: ${rid}`)
      openStream(rid)
    } catch (e) {
      setStatus("error")
      appendLog(`[start] ${String(e)}`)
    }
  }

  const handlePause = async () => {
    if (!runId) return
    try {
      await callApi("/api/agent/pause", { runId })
      setStatus("paused")
      appendLog("Paused")
    } catch (e) {
      appendLog(`[pause] ${String(e)}`)
    }
  }

  const handleResume = async () => {
    if (!runId) return
    try {
      await callApi("/api/agent/resume", { runId })
      setStatus("running")
      appendLog("Resumed")
    } catch (e) {
      appendLog(`[resume] ${String(e)}`)
    }
  }

  const handleStop = async () => {
    if (!runId) return
    try {
      await callApi("/api/agent/stop", { runId })
      setStatus("stopped")
      appendLog("Stopped")
      closeStream()
    } catch (e) {
      appendLog(`[stop] ${String(e)}`)
    }
  }

  const handleClear = () => {
    setTaskText("")
    setLogs([])
    setRunId(null)
    setStatus("idle")
    closeStream()
  }

  const getActiveTab = async (): Promise<chrome.tabs.Tab | undefined> => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab
  }

  const getDomHtml = async (tabId: number): Promise<string> => {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.documentElement.outerHTML
    })
    return String(result || "")
  }

  const captureScreenshot = async (): Promise<{
    mime: string
    b64: string
  }> => {
    const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
      format: "png"
    })
    // dataUrl like: data:image/png;base64,AAA...
    const [prefix, b64] = String(dataUrl).split(",", 2)
    const mime = prefix.substring(prefix.indexOf(":") + 1, prefix.indexOf(";"))
    return { mime, b64 }
  }

  const handleAnalyze = async () => {
    try {
      appendLog("[analysis] capturing page…")
      const tab = await getActiveTab()
      if (!tab?.id) throw new Error("No active tab")
      const domHtml = await getDomHtml(tab.id)
      const shot = await captureScreenshot()

      const body = {
        page_url: tab.url || null,
        dom_html: domHtml,
        screenshots: [
          {
            mime_type: shot.mime,
            data_base64: shot.b64
          }
        ],
        user_prompt: "Analyze this page and suggest safe UI actions."
      }

      appendLog("[analysis] sending to backend…")
      const res = await callApi("/api/analysis", body)
      appendLog(`[analysis] response: ${JSON.stringify(res)}`)
      console.log("/api/analysis response", res)
    } catch (e) {
      appendLog(`[analysis] error: ${String(e)}`)
      console.error("/api/analysis failed", e)
    }
  }

  return (
    <div
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minHeight: "100vh"
      }}>
      {!isOverlayActive ? (
        <button
          onClick={handleTakeOver}
          style={{
            background: "#007aff",
            border: "none",
            borderRadius: "8px",
            padding: "12px 20px",
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: "500",
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            boxShadow: "0 2px 8px rgba(0, 122, 255, 0.3)"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#0056b3"
            e.currentTarget.style.transform = "translateY(-1px)"
            e.currentTarget.style.boxShadow =
              "0 4px 12px rgba(0, 122, 255, 0.4)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#007aff"
            e.currentTarget.style.transform = "translateY(0)"
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 122, 255, 0.3)"
          }}>
          Take Over Screen
        </button>
      ) : (
        <button
          onClick={handleReclaimControl}
          style={{
            background: "#ff3b30",
            border: "none",
            borderRadius: "8px",
            padding: "12px 20px",
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: "500",
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            boxShadow: "0 2px 8px rgba(255, 59, 48, 0.3)"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#d70015"
            e.currentTarget.style.transform = "translateY(-1px)"
            e.currentTarget.style.boxShadow =
              "0 4px 12px rgba(255, 59, 48, 0.4)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#ff3b30"
            e.currentTarget.style.transform = "translateY(0)"
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(255, 59, 48, 0.3)"
          }}>
          Reclaim Control
        </button>
      )}
      <div style={{ width: "100%", maxWidth: 720 }}>
        <div style={{ marginBottom: 8, color: "#9aa0a6", fontSize: 13 }}>
          Describe the task for the agent
        </div>
        <textarea
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          placeholder="Enter your task here or provide assistance when asked."
          rows={4}
          style={{
            width: "100%",
            background: "#1e1f24",
            color: "#e8eaed",
            border: "1px solid #3c4043",
            borderRadius: 8,
            padding: 10,
            resize: "vertical"
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            onClick={handleStop}
            disabled={!runId || status === "idle"}
            style={{
              background: "#8f1d1d",
              border: "none",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#fff",
              cursor: runId ? "pointer" : "not-allowed"
            }}>
            Stop
          </button>
          {status === "paused" ? (
            <button
              onClick={handleResume}
              disabled={!runId}
              style={{
                background: "#2d5f2e",
                border: "none",
                borderRadius: 8,
                padding: "10px 14px",
                color: "#fff",
                cursor: runId ? "pointer" : "not-allowed"
              }}>
              Resume
            </button>
          ) : (
            <button
              onClick={handlePause}
              disabled={!runId || status !== "running"}
              style={{
                background: "#2d3a59",
                border: "none",
                borderRadius: 8,
                padding: "10px 14px",
                color: "#fff",
                cursor:
                  runId && status === "running" ? "pointer" : "not-allowed"
              }}>
              Pause
            </button>
          )}
          <button
            onClick={handleClear}
            style={{
              background: "#3c4043",
              border: "none",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#e8eaed",
              cursor: "pointer"
            }}>
            Clear
          </button>
          <button
            onClick={handleAnalyze}
            style={{
              background: "#1f6feb",
              border: "none",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#fff",
              cursor: "pointer"
            }}>
            Analyze Page
          </button>
          <button
            onClick={handleSubmitTask}
            disabled={!taskText || status === "running"}
            style={{
              background: "#0b57d0",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              color: "#fff",
              marginLeft: "auto",
              cursor:
                taskText && status !== "running" ? "pointer" : "not-allowed"
            }}>
            Submit Task
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "#9aa0a6" }}>
          Status: {status} · {llmInfo}
        </div>
        <div
          style={{
            marginTop: 8,
            background: "#0f1115",
            border: "1px solid #3c4043",
            borderRadius: 8,
            padding: 10,
            height: 220,
            overflow: "auto",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 12,
            color: "#e8eaed"
          }}>
          {logs.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Task outputs will appear here…</div>
          ) : (
            logs.map((l, i) => <div key={i}>{l}</div>)
          )}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <input
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value)
              saveConfig(e.target.value, token)
            }}
            placeholder="API Base URL"
            style={{
              flex: 1,
              background: "#1e1f24",
              color: "#e8eaed",
              border: "1px solid #3c4043",
              borderRadius: 8,
              padding: "8px 10px"
            }}
          />
          <input
            value={token || ""}
            onChange={(e) => {
              const next = e.target.value
              setToken(next)
              saveConfig(baseUrl, next)
            }}
            placeholder="Bearer Token (optional)"
            style={{
              flex: 1,
              background: "#1e1f24",
              color: "#e8eaed",
              border: "1px solid #3c4043",
              borderRadius: 8,
              padding: "8px 10px"
            }}
          />
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: "#6b7280",
            textAlign: "right"
          }}>
          V0.0.3
        </div>
      </div>
    </div>
  )
}

export default SidePanel
