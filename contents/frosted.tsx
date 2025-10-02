import type { PlasmoCSConfig } from "plasmo"
import React, { useEffect } from "react"
import { createRoot, type Root } from "react-dom/client"
import { animate } from "motion"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_idle",
  all_frames: false
}

// Suppress extension context invalidated errors immediately
try {
  // Override the global Error constructor
  const originalError = Error
  const originalConsoleError = console.error

  // Override Error constructor
  Error = function (message) {
    if (message?.includes("Extension context invalidated")) {
      console.warn(
        "Extension context invalidated - this is normal during development reloads"
      )
      return new originalError("Suppressed extension context error")
    }
    return new originalError(message)
  } as any

  // Override console.error to catch and suppress the error
  console.error = (...args) => {
    const message = args.join(" ")
    if (message.includes("Extension context invalidated")) {
      console.warn(
        "Extension context invalidated - this is normal during development reloads"
      )
      return
    }
    originalConsoleError.apply(console, args)
  }

  // Override throw to catch extension context errors
  const originalThrow = Error.prototype.constructor
  Error.prototype.constructor = function (message) {
    if (message?.includes("Extension context invalidated")) {
      console.warn(
        "Extension context invalidated - this is normal during development reloads"
      )
      return
    }
    return originalThrow.call(this, message)
  }
} catch (e) {
  // Ignore if we can't override these
}

// --- Shadow host setup ---
const HOST_ID = "__frosted_takeover_overlay_host__"
const BTN_ID = "__frosted_overlay_toggle_btn__"
const VOLUME_BAR_COUNT = 48

function ensureShadowHost(): { host: HTMLDivElement; shadow: ShadowRoot } {
  let host = document.getElementById(HOST_ID) as HTMLDivElement | null
  if (!host) {
    host = document.createElement("div")
    host.id = HOST_ID
    document.documentElement.appendChild(host)
  }
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" })
  return { host, shadow }
}

// --- Floating Toggle Button ---
let buttonContainer: HTMLDivElement | null = null

const buttonStyles = `
#toggle-frosted-overlay-btn {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 32px;
  height: 32px;
  background: #0b57d0; /* blue */
  border-radius: 4px; /* small square with slight rounding */
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  cursor: pointer;
  /* Use max safe z-index for Chromium (signed 32-bit int) */
  z-index: 2147483647; /* above overlay */
  transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
}
#toggle-frosted-overlay-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
#toggle-frosted-overlay-btn:active { transform: translateY(0); }
`

function mountControlButton() {
  try {
    const { shadow } = ensureShadowHost()
    if (buttonContainer) return
    buttonContainer = document.createElement("div")
    // Minimal shadow content: a style tag and the button itself
    const styleEl = document.createElement("style")
    styleEl.textContent = buttonStyles
    const btn = document.createElement("div")
    btn.id = "toggle-frosted-overlay-btn"
    btn.setAttribute("role", "button")
    btn.setAttribute("tabindex", "0")
    btn.setAttribute("aria-label", "Toggle overlay")
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      toggleOverlay()
    })
    btn.addEventListener("keydown", (e: any) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        toggleOverlay()
      }
    })
    buttonContainer.appendChild(styleEl)
    buttonContainer.appendChild(btn)
    shadow.appendChild(buttonContainer)
  } catch (e) {
    console.warn("Failed to mount toggle button:", e)
  }
}

function unmountControlButton() {
  try {
    if (buttonContainer) {
      buttonContainer.remove()
      buttonContainer = null
    }
  } catch (e) {
    console.warn("Failed to remove toggle button:", e)
  }
}

// --- Assets (pics) ---
// Use new URL with import.meta.url so bundler includes files
const slide1 = new URL("../pics/Slide1.png", import.meta.url).href
const slide2 = new URL("../pics/Slide2.png", import.meta.url).href
const slide3 = new URL("../pics/Slide3.png", import.meta.url).href
const slide4 = new URL("../pics/Slide4.png", import.meta.url).href
const slide5 = new URL("../pics/Slide5.png", import.meta.url).href
const slide6 = new URL("../pics/Slide6.png", import.meta.url).href
const slide7 = new URL("../pics/Slide7.png", import.meta.url).href

const styles = `
/* Keep overlay slightly below the button to avoid covering it */
.overlay { position: fixed; inset: 0; z-index: 2147483646; }
.overlay {
  display: block;
  pointer-events: auto;
  overflow-y: auto;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
  /* Scroll snap: one card per step */
  scroll-snap-type: y mandatory;
  scroll-behavior: smooth;
  overscroll-behavior: contain;
  background: rgba(20, 18, 13, 0.22);
  backdrop-filter: blur(var(--blur, 8px));
  -webkit-backdrop-filter: blur(var(--blur, 8px));
  -webkit-font-smoothing: antialiased;
  color: #feffd9;
  font-size: 12px;
  line-height: 15.6px;
  font-weight: 400;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif;
  will-change: clip-path, backdrop-filter, background-color;
}
@keyframes card-fade-in { from { opacity: 0; } to { opacity: 1; } }
.overlay *, .overlay *::before, .overlay *::after { box-sizing: border-box; margin: 0; padding: 0; }
.section.hero.fixed {
  background-color: transparent; color: #121111; width: 100vw; height: 100vh;
  position: fixed; top: 0; left: 0; z-index: 1; pointer-events: none;
}
.n-container.hero { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }
.portfolio-section { position: relative; z-index: 2; margin-top: 40vh; }
.image-overlay-wrap.portfolio { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 60px; padding: 60px 0; position: relative; max-width: 1200px; margin: 0 auto; z-index: 3; transition: all; --card-width: 50vw; }
.project-wrapped { display: flex; flex-direction: column; width: clamp(280px, var(--card-width, 50vw), 960px); height: auto; text-decoration: none; color: inherit; transition: all; box-shadow: #14120d 0px 2px 5px 0px; position: relative; scroll-snap-align: center; scroll-snap-stop: always; opacity: 0; animation: card-fade-in 0.6s ease forwards; }
.image-overlay-wrap.portfolio > .project-wrapped:nth-child(1) { animation-delay: 0.05s; }
.image-overlay-wrap.portfolio > .project-wrapped:nth-child(2) { animation-delay: 0.1s; }
.image-overlay-wrap.portfolio > .project-wrapped:nth-child(3) { animation-delay: 0.15s; }
.image-overlay-wrap.portfolio > .project-wrapped:nth-child(4) { animation-delay: 0.2s; }
.image-overlay-wrap.portfolio > .project-wrapped:nth-child(5) { animation-delay: 0.25s; }
.image-overlay-wrap.portfolio > .project-wrapped:nth-child(6) { animation-delay: 0.3s; }
.image-overlay-wrap.portfolio > .project-wrapped:nth-child(7) { animation-delay: 0.35s; }
.image-overlay-wrap.portfolio > .project-wrapped:nth-child(8) { animation-delay: 0.4s; }
.image-overlay-wrap.portfolio > .project-wrapped:not(.record-card):nth-child(odd) { transform: matrix(0.99863, 0.052336, -0.052336, 0.99863, 0, 0); }
.image-overlay-wrap.portfolio > .project-wrapped:not(.record-card):nth-child(even) { transform: matrix(0.99863, -0.052336, 0.052336, 0.99863, 0, 0); }
.project-cover-wrapper { display: flex; align-items: center; justify-content: center; width: 100%; height: auto; padding: 0; overflow: hidden; transition: all; }
.project-cover-wrapper.gh { background-color: #f5f2ed; }
.project-cover-wrapper.kori { background-color: #2a2a2a; }
.project-cover-wrapper.kiarra { background-color: #d4b896; }
.project-cover-wrapper.hommage { background-color: #1a1a1a; }
.project-cover-wrapper.agents { background-color: #e8e5e0; }
.project-cover-wrapper.scale { background-color: #2d2d2d; }
.project-cover-wrapper.aura { background-color: #f0f0f0; }
.stretched { display: block; width: 100%; height: auto; transition: all; }
.stretched img { width: 100%; height: auto; object-fit: cover; display: block; transition: all 0.3s ease; filter: grayscale(0%); }
.project-description-wrapper { background-color: #feffd9; color: #feffd9; padding: clamp(16px, 2.2vw, 28px) clamp(20px, 2.4vw, 32px); width: 100%; min-height: auto; border-radius: 0px; }
.project-description-wrapper h4 { color: #121111; font-size: clamp(10px, 1.2vw, 18px); line-height: 1.6; text-align: center; font-weight: 400; margin-bottom: clamp(6px, 0.8vw, 12px); text-transform: uppercase; letter-spacing: clamp(0.3px, 0.08vw, 1px); }
.project-description-wrapper h2 { color: #121111; font-size: clamp(12px, 1.5vw, 22px); line-height: 1.5; text-align: center; font-weight: 400; margin-bottom: clamp(10px, 1vw, 18px); max-width: 85%; margin-left: auto; margin-right: auto; }
.service-tags { text-align: center; font-size: clamp(10px, 1.1vw, 18px); color: #121111; line-height: 1.6; }
.project-wrapped:hover .stretched img { filter: grayscale(100%); }
@media (max-width: 1200px) { .image-overlay-wrap.portfolio { padding: 40px 20px; } .project-wrapped { width: min(90%, clamp(280px, var(--card-width, 50vw), 720px)); } .project-cover-wrapper, .project-description-wrapper { width: 100%; } }
@media (max-width: 480px) { .image-overlay-wrap.portfolio { gap: 40px; padding: 30px 15px; } .project-cover-wrapper { height: 200px; padding: 0; } .stretched { width: 100%; height: auto; max-height: 200px; } .stretched img { width: 100%; height: auto; max-height: 200px; } }
.hero-content { text-align: center; color: #121111; }
.hero-content h1 { font-size: 48px; font-weight: 400; margin-bottom: 20px; letter-spacing: 2px; }
.hero-content p { font-size: 14px; line-height: 20px; max-width: 500px; margin: 0 auto; }
.project-wrapped.record-card { cursor: pointer; background-color: rgba(254, 255, 217, 0.92); border: 1px solid rgba(20, 18, 13, 0.15); box-shadow: #14120d 0px 3px 12px 0px; transition: transform 0.25s ease, box-shadow 0.25s ease; }
.project-wrapped.record-card:hover { box-shadow: #14120d 0px 6px 18px 0px; transform: translateY(-2px); }
.project-wrapped.record-card:focus-visible { outline: 2px solid #0b57d0; outline-offset: 4px; box-shadow: #0b57d0 0px 0px 0px 2px inset; }
.project-cover-wrapper.recorder { background: linear-gradient(135deg, rgba(245, 242, 237, 0.95), rgba(193, 206, 245, 0.65)); min-height: clamp(180px, 28vh, 320px); }
.recording-panel { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(8px, 1.2vw, 18px); text-align: center; color: #121111; padding: clamp(20px, 3vw, 40px); width: 100%; }
.recording-status { display: flex; align-items: center; gap: clamp(8px, 1vw, 16px); font-size: clamp(12px, 1.4vw, 22px); font-weight: 500; }
.record-status-dot { width: clamp(10px, 1.2vw, 16px); height: clamp(10px, 1.2vw, 16px); border-radius: 50%; background: #d70015; box-shadow: 0 0 8px rgba(215, 0, 21, 0.45); opacity: 0.85; }
.record-status-dot.active { animation: record-pulse 1.4s ease-in-out infinite; }
.recording-subtext { font-size: clamp(12px, 1.15vw, 18px); color: #3d3a30; max-width: 90%; margin: 0 auto; }
.project-description-wrapper.record-description { display: flex; flex-direction: column; align-items: center; gap: clamp(12px, 1.4vw, 24px); }
.project-description-wrapper.record-description audio { width: 100%; outline: none; }
.record-placeholder { width: 100%; text-align: center; color: #6f6a60; font-size: clamp(11px, 1.1vw, 17px); border: 1px dashed rgba(20, 18, 13, 0.2); padding: clamp(12px, 1.6vw, 20px); border-radius: 8px; background: rgba(254, 255, 217, 0.4); }
.record-error { margin-top: 4px; color: #d70015; font-size: clamp(11px, 1.05vw, 16px); text-align: center; }
.transcribing-indicator { display: flex; align-items: center; gap: clamp(8px, 1vw, 16px); color: #3d3a30; font-size: clamp(12px, 1.2vw, 18px); }
.spinner { width: clamp(14px, 1.6vw, 20px); height: clamp(14px, 1.6vw, 20px); border: 3px solid rgba(11, 87, 208, 0.2); border-top-color: #0b57d0; border-radius: 50%; animation: spinner-rotate 0.9s linear infinite; }
.transcription-box { width: 100%; text-align: left; color: #121111; font-size: clamp(12px, 1.2vw, 18px); line-height: 1.6; background: rgba(254, 255, 217, 0.7); border-radius: 10px; padding: clamp(14px, 1.8vw, 24px); border: 1px solid rgba(20, 18, 13, 0.12); box-shadow: inset 0 1px 3px rgba(20, 18, 13, 0.12); white-space: pre-wrap; word-break: break-word; }
.volume-visualizer { width: 100%; height: clamp(54px, 6.5vw, 110px); display: flex; align-items: center; gap: clamp(3px, 0.5vw, 6px); padding: clamp(10px, 1.2vw, 14px) clamp(8px, 1vw, 12px); border-radius: 14px; background: linear-gradient(180deg, rgba(255, 255, 255, 0.75) 0%, rgba(254, 255, 217, 0.55) 100%); border: 1px solid rgba(11, 87, 208, 0.2); box-shadow: inset 0 1px 6px rgba(11, 87, 208, 0.15), 0 8px 18px rgba(11, 87, 208, 0.12); transition: opacity 0.25s ease, transform 0.25s ease; }
.volume-bar { flex: 1; height: 100%; border-radius: 999px; background: linear-gradient(180deg, rgba(11, 87, 208, 0.95) 0%, rgba(11, 87, 208, 0.45) 100%); box-shadow: 0 4px 10px rgba(11, 87, 208, 0.18); transform-origin: center; transition: transform 0.12s ease-out, opacity 0.25s ease; }
.volume-bar.muted { opacity: 0.2; }
.volume-visualizer.idle { opacity: 0.45; transform: translateY(4px); }
@keyframes record-pulse { 0% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.35); opacity: 0.4; } 100% { transform: scale(1); opacity: 0.8; } }
@keyframes spinner-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.card-size-control { position: fixed; right: clamp(16px, 3vw, 36px); bottom: clamp(16px, 3vw, 36px); display: flex; align-items: center; gap: clamp(10px, 1.2vw, 18px); padding: clamp(10px, 1.4vw, 18px); background: rgba(20, 18, 13, 0.7); border-radius: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); z-index: 2147483647; color: #feffd9; }
.card-size-control span { font-size: clamp(12px, 1.2vw, 16px); opacity: 0.8; }
.card-size-actions { display: flex; gap: clamp(8px, 1vw, 14px); }
.card-size-btn { min-width: clamp(40px, 4vw, 64px); padding: clamp(6px, 0.8vw, 10px) clamp(10px, 1.2vw, 14px); border-radius: 999px; border: 1px solid rgba(254, 255, 217, 0.25); background: rgba(254, 255, 217, 0.12); color: inherit; font-size: clamp(12px, 1.2vw, 16px); cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.card-size-btn:hover { background: rgba(254, 255, 217, 0.2); border-color: rgba(254, 255, 217, 0.4); }
.card-size-btn.active { background: #feffd9; color: #201f1a; border-color: transparent; box-shadow: 0 4px 18px rgba(254, 255, 217, 0.35); }
.card-size-btn span { font-size: clamp(10px, 1vw, 14px); opacity: 0.65; }
`

export function Overlay({ onClose }: { onClose: () => void }) {
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const overlayRef = React.useRef<HTMLElement | null>(null)
  const [isRecording, setIsRecording] = React.useState(false)
  const [recordError, setRecordError] = React.useState<string | null>(null)
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = React.useState(false)
  const [transcription, setTranscription] = React.useState<string | null>(null)
  const [transcribeError, setTranscribeError] = React.useState<string | null>(null)
  const [cardWidthRatio, setCardWidthRatio] = React.useState(0.5)
  const [volumeLevels, setVolumeLevels] = React.useState<number[]>(() =>
    Array.from({ length: VOLUME_BAR_COUNT }, () => 0)
  )
  const previousLevelsRef = React.useRef<number[]>(
    Array.from({ length: VOLUME_BAR_COUNT }, () => 0)
  )
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const audioChunksRef = React.useRef<Blob[]>([])
  const audioUrlRef = React.useRef<string | null>(null)
  const audioBlobRef = React.useRef<Blob | null>(null)
  const isMountedRef = React.useRef(true)
  const transcribeJobRef = React.useRef(0)
  const audioContextRef = React.useRef<AudioContext | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const dataArrayRef = React.useRef<Uint8Array | null>(null)
  const volumeRafRef = React.useRef<number | null>(null)
  const streamSourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null)
  const openaiApiKey = process.env.PLASMO_PUBLIC_OPENAI_KEY as string | undefined
  const cardSizeOptions = React.useMemo(
    () => [
      { label: "S", value: 0.3, percent: "30%" },
      { label: "M", value: 0.5, percent: "50%" },
      { label: "L", value: 0.7, percent: "70%" }
    ],
    []
  )

  const stopVolumeMeter = React.useCallback(() => {
    if (volumeRafRef.current) {
      cancelAnimationFrame(volumeRafRef.current)
      volumeRafRef.current = null
    }
    try {
      streamSourceRef.current?.disconnect()
      analyserRef.current?.disconnect()
    } catch {}
    streamSourceRef.current = null
    analyserRef.current = null
    if (audioContextRef.current) {
      // Closing an already closed context throws
      const ctx = audioContextRef.current
      if (ctx.state !== "closed") {
        ctx.close().catch(() => undefined)
      }
    }
    audioContextRef.current = null
    dataArrayRef.current = null
    previousLevelsRef.current = Array.from({ length: VOLUME_BAR_COUNT }, () => 0)
    setVolumeLevels(Array.from({ length: VOLUME_BAR_COUNT }, () => 0))
  }, [])

  const startVolumeMeter = React.useCallback(
    async (stream: MediaStream) => {
      try {
        stopVolumeMeter()
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioCtx) {
          return
        }

        const audioCtx = new AudioCtx()
        audioContextRef.current = audioCtx
        if (audioCtx.state === "suspended") {
          try {
            await audioCtx.resume()
          } catch (resumeError) {
            console.warn("Audio context resume failed", resumeError)
          }
        }
        const source = audioCtx.createMediaStreamSource(stream)
        streamSourceRef.current = source
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.65
        analyserRef.current = analyser
        const bufferLength = analyser.fftSize
        const dataArray = new Uint8Array(bufferLength)
        dataArrayRef.current = dataArray

        source.connect(analyser)

        const barCount = VOLUME_BAR_COUNT
        const smoothFactor = 0.35

        const tick = () => {
          if (!analyserRef.current || !dataArrayRef.current) {
            return
          }
          analyserRef.current.getByteTimeDomainData(dataArrayRef.current)
          const segmentSize = Math.max(1, Math.floor(dataArrayRef.current.length / barCount))
          const nextLevels: number[] = []
          for (let i = 0; i < barCount; i++) {
            const start = i * segmentSize
            let sumSquares = 0
            for (let j = 0; j < segmentSize && start + j < dataArrayRef.current.length; j++) {
              const sample = dataArrayRef.current[start + j] - 128
              sumSquares += sample * sample
            }
            const rms = Math.sqrt(sumSquares / segmentSize) / 128 || 0
            nextLevels.push(rms)
          }
          const smoothedLevels = nextLevels.map((level, idx) => {
            const previous = previousLevelsRef.current[idx] ?? 0
            const blended = previous * (1 - smoothFactor) + level * smoothFactor
            return Math.min(1, Math.max(0, blended))
          })
          previousLevelsRef.current = smoothedLevels
          setVolumeLevels(smoothedLevels)
          volumeRafRef.current = requestAnimationFrame(tick)
        }

        volumeRafRef.current = requestAnimationFrame(tick)
      } catch (error) {
        console.warn("Unable to initialise volume meter", error)
      }
    },
    [stopVolumeMeter]
  )

  const transcribeAudio = React.useCallback(
    async (blob: Blob, jobId: number) => {
      if (transcribeJobRef.current !== jobId) {
        return
      }

      if (!openaiApiKey) {
        setTranscribeError("Please configure the OpenAI API key before transcribing.")
        return
      }

      setIsTranscribing(true)
      setTranscribeError(null)

      try {
        const formData = new FormData()
        formData.append("model", "gpt-4o-mini-transcribe")
        formData.append("file", blob, `recording-${Date.now()}.webm`)

        const response = await fetch(
          "https://api.openai.com/v1/audio/transcriptions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiApiKey}`
            },
            body: formData
          }
        )

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null)
          const message =
            errorBody?.error?.message || "Transcription failed, please try again later."
          throw new Error(message)
        }

        const data = await response.json()
        const text = data?.text || data?.data?.[0]?.text || ""
        if (!isMountedRef.current || transcribeJobRef.current !== jobId) return
        setTranscription(text || "(No transcription available yet)")
      } catch (error: any) {
        if (!isMountedRef.current || transcribeJobRef.current !== jobId) return
        console.warn("Transcription failed", error)
        setTranscribeError(error?.message || "Transcription failed, please try again later.")
      } finally {
        if (isMountedRef.current && transcribeJobRef.current === jobId) {
          setIsTranscribing(false)
        }
      }
    },
    [openaiApiKey]
  )

  const updateAudioUrl = React.useCallback((url: string | null) => {
    setAudioUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev)
      }
      return url
    })
    audioUrlRef.current = url
    if (!url) {
      audioBlobRef.current = null
    }
  }, [])

  const stopRecording = React.useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== "inactive") {
      recorder.stop()
    }
  }, [])

  const startRecording = React.useCallback(async () => {
    setRecordError(null)
    setTranscription(null)
    setTranscribeError(null)
    setIsTranscribing(false)
    audioBlobRef.current = null
    transcribeJobRef.current += 1

    if (typeof MediaRecorder === "undefined") {
      setRecordError("This browser does not support audio recording.")
      return
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setRecordError("Unable to access the microphone in this environment.")
      return
    }

    try {
      updateAudioUrl(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      await startVolumeMeter(stream)

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onerror = (event) => {
        console.warn("Recorder error", event)
        stopVolumeMeter()
        stream.getTracks().forEach((track) => track.stop())
        mediaRecorderRef.current = null
        audioChunksRef.current = []
        if (!isMountedRef.current) {
          return
        }
        setRecordError("Something went wrong while recording, please try again.")
        setIsRecording(false)
      }

      recorder.onstop = () => {
        stopVolumeMeter()
        stream.getTracks().forEach((track) => track.stop())
        const chunks = audioChunksRef.current
        mediaRecorderRef.current = null
        audioChunksRef.current = []

        const shouldUpdate = chunks.length > 0
        const mimeType = recorder.mimeType || "audio/webm"
        const blob = shouldUpdate ? new Blob(chunks, { type: mimeType }) : null
        const url = blob ? URL.createObjectURL(blob) : null

        if (!isMountedRef.current) {
          if (url) {
            URL.revokeObjectURL(url)
          }
          return
        }

        if (url) {
          updateAudioUrl(url)
          audioBlobRef.current = blob
          const jobId = transcribeJobRef.current
          if (blob) {
            void transcribeAudio(blob, jobId)
          }
        } else {
          updateAudioUrl(null)
          audioBlobRef.current = null
        }
        setIsRecording(false)
      }

      recorder.start()
      setIsRecording(true)
    } catch (error) {
      console.warn("Failed to start recording", error)
      updateAudioUrl(null)
      if (!isMountedRef.current) {
        return
      }
      stopVolumeMeter()
      setRecordError("Unable to start recording. Please check microphone permissions.")
      setIsRecording(false)
    }
  }, [startVolumeMeter, stopVolumeMeter, transcribeAudio, updateAudioUrl])

  const handleRecordCardAction = React.useCallback(async () => {
    if (isRecording) {
      stopRecording()
      return
    }
    await startRecording()
  }, [isRecording, startRecording, stopRecording])

  const handleRecordCardClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      void handleRecordCardAction()
    },
    [handleRecordCardAction]
  )

  const handleRecordCardKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        void handleRecordCardAction()
      }
    },
    [handleRecordCardAction]
  )

  const handleCardSizeSelect = React.useCallback((value: number) => {
    setCardWidthRatio(value)
  }, [])

  React.useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== "inactive") {
        recorder.stop()
      }
      mediaRecorderRef.current = null
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
      }
      stopVolumeMeter()
    }
  }, [stopVolumeMeter])

  useEffect(() => {
    // Overlay reveal from the blue button (freeze blur effect)
    const overlayEl = overlayRef.current
    if (overlayEl) {
      let btnEl: HTMLElement | null = null
      const rootNode = overlayEl.getRootNode() as Document | ShadowRoot
      if ((rootNode as ShadowRoot).host) {
        try {
          btnEl = (rootNode as ShadowRoot).getElementById?.(
            "toggle-frosted-overlay-btn"
          ) as HTMLElement | null
        } catch {}
      }
      if (!btnEl && typeof document !== "undefined") {
        btnEl = document.getElementById(
          "toggle-frosted-overlay-btn"
        ) as HTMLElement | null
      }

      const vw = window.innerWidth
      const vh = window.innerHeight
      let x = vw / 2
      let y = vh / 2
      if (btnEl) {
        const r = btnEl.getBoundingClientRect()
        x = r.left + r.width / 2
        y = r.top + r.height / 2
      }

      const distTL = Math.hypot(x - 0, y - 0)
      const distTR = Math.hypot(x - vw, y - 0)
      const distBL = Math.hypot(x - 0, y - vh)
      const distBR = Math.hypot(x - vw, y - vh)
      const maxR = Math.ceil(Math.max(distTL, distTR, distBL, distBR)) + 20

      overlayEl.style.clipPath = `circle(0px at ${x}px ${y}px)`
      overlayEl.style.setProperty("--blur", "0px")
      overlayEl.style.backgroundColor = "rgba(11, 87, 208, 0.20)" // Light blue starting color to match the button

      animate(
        overlayEl as Element,
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxR}px at ${x}px ${y}px)`
          ],
          "--blur": ["0px", "8px"],
          backgroundColor: [
            "rgba(11, 87, 208, 0.20)",
            "rgba(20, 18, 13, 0.22)"
          ]
        } as any,
        { duration: 0.6, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" } as any
      )
    }

    const onKey = (e: KeyboardEvent) => {
      // if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey, { capture: true })
    return () => window.removeEventListener("keydown", onKey, { capture: true })
  }, [onClose])

  useEffect(() => {
    // Card cascade: fade in, rotate from 0deg, y -10px -> 0px
    const root = listRef.current
    if (!root) return
    const cards = root.querySelectorAll<HTMLElement>(".project-wrapped")
    cards.forEach((el, i) => {
      el.style.opacity = "0"
      el.style.transform = "rotate(0deg) translateY(-10px)"
      const finalRotate = i % 2 === 0 ? 3 : -3
      animate(
        el as Element,
        {
          opacity: [0, 1],
          transform: [
            "rotate(0deg) translateY(-10px)",
            `rotate(${finalRotate}deg) translateY(0px)`
          ]
        } as any,
        { duration: 0.6, delay: i * 0.06, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" } as any
      )
    })
  }, [])

  return (
    <>
      <style>{styles}</style>
      <section className="overlay" role="dialog" aria-modal="true" ref={overlayRef}>

        {/* Scrollable project list */}
        <div className="portfolio-section">
          <div
            className="image-overlay-wrap portfolio"
            ref={listRef}
            style={{ ["--card-width" as any]: `${cardWidthRatio * 100}vw` }}
          >
            <div
              className="project-wrapped record-card"
              role="button"
              tabIndex={0}
              onClick={handleRecordCardClick}
              onKeyDown={handleRecordCardKeyDown}
              aria-pressed={isRecording}
            >
              <div className="project-cover-wrapper recorder">
                <div className="recording-panel">
                  <div className="recording-status">
                    <span
                      className={`record-status-dot${isRecording ? " active" : ""}`}
                      aria-hidden="true"
                    />
                    <span>
                      {isRecording
                        ? "Recording… click to stop"
                        : isTranscribing
                        ? "Processing audio… please wait"
                        : audioUrl
                        ? "Recording saved, click to record again"
                        : "Click to start recording"}
                    </span>
                  </div>
                  <div
                    className={`volume-visualizer${!isRecording ? " idle" : ""}`}
                    style={{ ["--volume-bars" as any]: volumeLevels.length }}
                    aria-hidden="true"
                  >
                    {volumeLevels.map((level, index) => {
                      const adjusted = Math.max(0.1, Math.pow(level, 0.8))
                      return (
                        <span
                          key={index}
                          className={`volume-bar${level < 0.05 ? " muted" : ""}`}
                          style={{ transform: `scaleY(${Math.min(1, adjusted)})` }}
                        />
                      )
                    })}
                  </div>
                  <p className="recording-subtext">
                    {isRecording
                      ? "Audio is being captured—click again when you're done."
                      : isTranscribing
                      ? "Uploading and sending to OpenAI for transcription. Please keep this window open."
                      : audioUrl
                      ? "Recording saved—you can play it back or capture a new one."
                      : "The first click will request microphone access and start recording immediately."}
                  </p>
                </div>
              </div>
              <div className="project-description-wrapper record-description">
                <h4 className="center-aligned black">Voice Notes Card</h4>
                <h2 className="smaller black">
                  {audioUrl
                    ? isTranscribing
                      ? "Recording saved—transcribing now."
                      : transcription
                      ? "Transcription below. Record again to update it."
                      : "Recording finished—use the player to listen back."
                    : "Click the card to start recording; playback and transcription will appear here."}
                </h2>
                {recordError ? (
                  <div className="record-error" role="alert">
                    {recordError}
                  </div>
                ) : null}
                {transcribeError ? (
                  <div className="record-error" role="alert">
                    {transcribeError}
                  </div>
                ) : null}
                {audioUrl ? (
                  <audio
                    key={audioUrl}
                    controls
                    src={audioUrl}
                    preload="metadata"
                  />
                ) : (
                  <div className="record-placeholder">
                    Once you finish recording, the audio will appear here.
                  </div>
                )}
                {isTranscribing ? (
                  <div className="transcribing-indicator">
                    <span className="spinner" aria-hidden="true" />
                    <span>Transcribing audio…</span>
                  </div>
                ) : transcription ? (
                  <div className="transcription-box">
                    {transcription}
                  </div>
                ) : null}
              </div>
            </div>
            <a
              href="#"
              className="project-wrapped w-inline-block"
            >
              <div className="project-cover-wrapper gh">
                <div className="stretched">
                  <img src={slide1} alt="Creative Project 1" loading="lazy" />
                </div>
              </div>
              <div className="project-description-wrapper more-padding">
                <h4 className="center-aligned black">Gesture Home • Chair Company</h4>
                <h2 className="smaller black">Repositioning chairs as heirloom pieces with influence on everyday comfort.</h2>
                <div className="service-tags">Branding</div>
              </div>
            </a>

            <a href="#" className="project-wrapped r w-inline-block">
              <div className="project-cover-wrapper kori">
                <div className="stretched">
                  <img src={slide2} alt="Creative Project 2" loading="lazy" />
                </div>
              </div>
              <div className="project-description-wrapper more-padding">
                <h4 className="center-aligned black">Kori Whitby • Copywriter</h4>
                <h2 className="smaller black">Blending the powers of creative thinking and technology to revolutionise a copywriter's brand presence.</h2>
                <div className="service-tags">Branding via Design Intensive<br/>Web design<br/>Web build</div>
              </div>
            </a>

            <a href="#" className="project-wrapped w-inline-block">
              <div className="project-cover-wrapper kiarra">
                <div className="stretched">
                  <img src={slide3} alt="Creative Project 3" loading="lazy" />
                </div>
              </div>
              <div className="project-description-wrapper more-padding">
                <h4 className="center-aligned black">Kiarra Soleil • Social Media Manager</h4>
                <h2 className="smaller black">Drawing on the iconic 60s to revive a social media manager's brand in a feel-good way.</h2>
                <div className="service-tags">Branding via Design Intensive</div>
              </div>
            </a>

            <a href="#" className="project-wrapped r w-inline-block">
              <div className="project-cover-wrapper hommage">
                <div className="stretched">
                  <img src={slide4} alt="Creative Project 4" loading="lazy" />
                </div>
              </div>
              <div className="project-description-wrapper more-padding">
                <h4 className="center-aligned black">Hommage • Book Shop</h4>
                <h2 className="smaller black">Bringing the appeal of physical books into the modern world.</h2>
                <div className="service-tags">Branding</div>
              </div>
            </a>

            <a href="#" className="project-wrapped w-inline-block">
              <div className="project-cover-wrapper agents">
                <div className="stretched">
                  <img src={slide5} alt="Creative Project 5" loading="lazy" />
                </div>
              </div>
              <div className="project-description-wrapper more-padding">
                <h4 className="center-aligned black">Agents by Brooke • Agent Referral Agency</h4>
                <h2 className="smaller black">Revolutionising a sketchy industry with a trustworthy brand.</h2>
                <div className="service-tags">Branding<br/>Web design<br/>Web build</div>
              </div>
            </a>

            <a href="#" className="project-wrapped r w-inline-block">
              <div className="project-cover-wrapper scale">
                <div className="stretched">
                  <img src={slide6} alt="Creative Project 6" loading="lazy" />
                </div>
              </div>
              <div className="project-description-wrapper more-padding">
                <h4 className="center-aligned black">Scale Your Socials • Social Media Agency</h4>
                <h2 className="smaller black">Fusing the styles of the past and future for a visionary agency.</h2>
                <div className="service-tags">Branding via Design Intensive</div>
              </div>
            </a>

            <a href="#" className="project-wrapped w-inline-block">
              <div className="project-cover-wrapper aura">
                <div className="stretched">
                  <img src={slide7} alt="Creative Project 7" loading="lazy" />
                </div>
              </div>
              <div className="project-description-wrapper more-padding">
                <h4 className="center-aligned black">Aura • Perfume</h4>
                <h2 className="smaller black">Redefining the standard for (unisex) perfume.</h2>
                <div className="service-tags">Branding</div>
              </div>
            </a>

            <div className="project-wrapped r">
              <div className="project-cover-wrapper" style={{ backgroundColor: "#f5f2ed", border: "2px dashed #ccc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center", color: "#666", fontSize: 14 }}>
                  <h4 style={{ color: "#333", marginBottom: 10 }}>[SPACE RESERVED FOR YOUR PROJECT]</h4>
                  <p>Your next creative project could be featured here</p>
                </div>
              </div>
              <div className="project-description-wrapper more-padding">
                <h4 className="center-aligned black">[Space Reserved for Your Project]</h4>
                <h2 className="smaller black">Ready to create something amazing together?</h2>
                <div className="service-tags">Let's chat</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="card-size-control" role="group" aria-label="Card size selector">
        <span>Card size</span>
        <div className="card-size-actions">
          {cardSizeOptions.map((option) => {
            const isActive = Math.abs(cardWidthRatio - option.value) < 0.001
            return (
              <button
                key={option.label}
                type="button"
                className={`card-size-btn${isActive ? " active" : ""}`}
                onClick={() => handleCardSizeSelect(option.value)}
                aria-pressed={isActive}
                title={`${option.percent} viewport width`}
              >
                {option.label}
                <span>{option.percent}</span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

// --- Mount / unmount helpers ---
let mountContainer: HTMLDivElement | null = null
let reactRoot: Root | null = null
let isExiting = false

function mountOverlay() {
  try {
    if (mountContainer) return // already mounted
    const { shadow } = ensureShadowHost()
    mountContainer = document.createElement("div")
    shadow.appendChild(mountContainer)
    const handleClose = () => unmountOverlay()
    reactRoot = createRoot(mountContainer)
    reactRoot.render(<Overlay onClose={handleClose} />)
  } catch (error) {
    console.warn("Error mounting overlay:", error)
  }
}

function unmountOverlay() {
  try {
    if (!mountContainer) return

    // Try to play exit animation if overlay element is present
    const overlayEl = mountContainer.querySelector('section.overlay') as HTMLElement | null
    const { shadow } = ensureShadowHost()
    const btnEl = shadow.getElementById('toggle-frosted-overlay-btn') as HTMLElement | null

    if (overlayEl && !isExiting) {
      isExiting = true
      const vw = window.innerWidth
      const vh = window.innerHeight
      let x = vw / 2
      let y = vh / 2
      if (btnEl) {
        const r = btnEl.getBoundingClientRect()
        x = r.left + r.width / 2
        y = r.top + r.height / 2
      }
      const distTL = Math.hypot(x - 0, y - 0)
      const distTR = Math.hypot(x - vw, y - 0)
      const distBL = Math.hypot(x - 0, y - vh)
      const distBR = Math.hypot(x - vw, y - vh)
      const maxR = Math.ceil(Math.max(distTL, distTR, distBL, distBR)) + 20

      // Ensure starting state matches the fully-open overlay
      overlayEl.style.clipPath = `circle(${maxR}px at ${x}px ${y}px)`
      overlayEl.style.setProperty('--blur', '8px')
      overlayEl.style.backgroundColor = 'rgba(20, 18, 13, 0.22)'

      const finish = () => {
        try {
          if (reactRoot) {
            reactRoot.unmount()
            reactRoot = null
          }
          mountContainer?.remove()
          mountContainer = null
        } catch (e) {
          console.warn('Error during final unmount:', e)
        } finally {
          isExiting = false
        }
      }

      const controls: any = animate(
        overlayEl as Element,
        {
          clipPath: [
            `circle(${maxR}px at ${x}px ${y}px)`,
            `circle(0px at ${x}px ${y}px)`
          ],
          '--blur': ['8px', '0px'],
          backgroundColor: [
            'rgba(20, 18, 13, 0.22)',
            'rgba(11, 87, 208, 0.20)'
          ]
        } as any,
        { duration: 0.6, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' } as any
      )

      if (controls && controls.finished && typeof controls.finished.then === 'function') {
        controls.finished.then(finish).catch(finish)
      } else {
        // Fallback
        setTimeout(finish, 650)
      }
      return
    }

    // If no element or already exiting, unmount immediately
    if (reactRoot) {
      reactRoot.unmount()
      reactRoot = null
    }
    mountContainer.remove()
    mountContainer = null
  } catch (error) {
    console.warn("Error unmounting overlay:", error)
  }
}

function toggleOverlay() {
  if (mountContainer) unmountOverlay()
  else mountOverlay()
}

// --- Message listener setup ---
let messageListener:
  | ((
      msg: any,
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response?: any) => void
    ) => void)
  | null = null

function setupMessageListener() {
  if (messageListener) return // Already set up

  messageListener = (msg, _sender, _send) => {
    console.log("Message received:", msg) // Debug log

    try {
      if (msg?.type === "TOGGLE_OVERLAY") {
        console.log("Toggling overlay")
        toggleOverlay()
      } else if (msg?.type === "SHOW_OVERLAY") {
        console.log("Showing overlay")
        mountOverlay()
      } else if (msg?.type === "HIDE_OVERLAY") {
        console.log("Hiding overlay")
        unmountOverlay()
      }

      // Send response back to indicate message was handled
      if (_send) {
        _send({ success: true })
      }
    } catch (error) {
      console.warn("Error handling message:", error)
      if (_send) {
        _send({ success: false, error: error.message })
      }
    }
  }

  try {
    chrome.runtime.onMessage.addListener(messageListener)
    console.log("Message listener added successfully")
  } catch (error) {
    console.warn("Failed to add message listener:", error)
  }
}

function cleanupMessageListener() {
  if (messageListener) {
    try {
      chrome.runtime.onMessage.removeListener(messageListener)
      console.log("Message listener removed")
    } catch (error) {
      console.warn("Failed to remove message listener:", error)
    }
    messageListener = null
  }
}

// Global error handler to catch extension context errors
window.addEventListener("error", (event) => {
  if (event.message?.includes("Extension context invalidated")) {
    console.warn(
      "Extension context invalidated - this is normal during development reloads"
    )
    event.preventDefault()
    event.stopPropagation()
    return false
  }
})

// Catch unhandled promise rejections that might contain extension context errors
window.addEventListener("unhandledrejection", (event) => {
  if (event.reason?.message?.includes("Extension context invalidated")) {
    console.warn(
      "Extension context invalidated (unhandled rejection) - this is normal during development reloads"
    )
    event.preventDefault()
    event.stopPropagation()
    return false
  }
})

// (Removed custom window/Error throw overrides to avoid TypeScript and runtime issues)

// Setup listener when script loads (with delay to ensure context is ready)
setTimeout(() => {
  try {
    setupMessageListener()
  } catch (error) {
    if (error.message?.includes("Extension context invalidated")) {
      console.warn(
        "Extension context invalidated during setup - this is normal during development reloads"
      )
    } else {
      console.warn("Error during message listener setup:", error)
    }
  }
}, 100)

// Default export for Plasmo content script
export default function FrostedContentScript() {
  useEffect(() => {
    // Ensure listener is set up
    setupMessageListener()
    // Mount floating toggle button
    mountControlButton()

    // Cleanup on unmount
    return () => {
      cleanupMessageListener()
      unmountControlButton()
    }
  }, [])

  return null // This component doesn't render anything directly
}
