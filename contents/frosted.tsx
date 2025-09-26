import type { PlasmoCSConfig } from "plasmo"
import React, { useEffect, useRef } from "react"
import { render, unmountComponentAtNode } from "react-dom"

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

// --- React Overlay Component ---
const styles = `
:host, .overlay {
  position: fixed; inset: 0; z-index: 2147483647;
}
.overlay {
  display: flex; 
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(245,247,250,0.25);
  backdrop-filter: blur(0px);
  -webkit-backdrop-filter: blur(0px);
  animation: blurIn 900ms ease forwards;
  pointer-events: auto; /* block page interaction */
}
@keyframes blurIn {
  0%   { backdrop-filter: blur(0px); }
  60%  { backdrop-filter: blur(10px); }
  100% { backdrop-filter: blur(16px); }
}
.content {
  text-align: center;
  color: #1d1d1f;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
  transform: translateY(20px);
  opacity: 0;
  animation: fadeInUp 600ms cubic-bezier(.2,.8,.2,1) 300ms forwards;
}
@keyframes fadeInUp { 
  to { transform: translateY(0); opacity: 1; } 
}
.title {
  font-size: clamp(48px, 8vw, 72px);
  font-weight: 300; 
  letter-spacing: 0.02em; 
  margin: 0 0 24px 0;
  color: black;
  line-height: 1.1;
  text-align: center;
}
.subtitle {
  font-size: clamp(20px, 4vw, 28px);
  color: black; 
  margin: 0; 
  line-height: 1.3;
  font-weight: 300;
  max-width: 600px;
  text-align: center;
  opacity: 0.9;
}
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
`

export function Overlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey, { capture: true })
    return () => window.removeEventListener("keydown", onKey, { capture: true })
  }, [onClose])

  return (
    <>
      <style>{styles}</style>
      <section
        className="overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fto-title"
        aria-describedby="fto-desc">
        <div className="content">
          <h1 id="fto-title" className="title">
            We'll take it from here
          </h1>
          <p id="fto-desc" className="subtitle">
            Sit back for a moment while we handle the next steps. Your screen is
            intentionally blurred.
          </p>
          <span className="sr-only" aria-live="polite">
            Press Escape to reclaim control at any time.
          </span>
        </div>
      </section>
    </>
  )
}

// --- Mount / unmount helpers ---
let mountContainer: HTMLDivElement | null = null

function mountOverlay() {
  try {
    if (mountContainer) return // already mounted
    const { shadow } = ensureShadowHost()
    mountContainer = document.createElement("div")
    shadow.appendChild(mountContainer)
    const handleClose = () => unmountOverlay()
    render(<Overlay onClose={handleClose} />, mountContainer)
  } catch (error) {
    console.warn("Error mounting overlay:", error)
  }
}

function unmountOverlay() {
  try {
    if (mountContainer) {
      unmountComponentAtNode(mountContainer)
      mountContainer.remove()
      mountContainer = null
    }
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

// Override the global throw function to catch extension context errors
const originalThrow = window.throw || (() => {})
window.throw = function (error) {
  if (error?.message?.includes("Extension context invalidated")) {
    console.warn(
      "Extension context invalidated - this is normal during development reloads"
    )
    return
  }
  throw error
}

// Override Error.prototype.throw to catch extension context errors
const originalErrorThrow = Error.prototype.throw
if (originalErrorThrow) {
  Error.prototype.throw = function () {
    if (this.message?.includes("Extension context invalidated")) {
      console.warn(
        "Extension context invalidated - this is normal during development reloads"
      )
      return
    }
    return originalErrorThrow.apply(this, arguments)
  }
}

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

    // Cleanup on unmount
    return () => {
      cleanupMessageListener()
    }
  }, [])

  return null // This component doesn't render anything directly
}
