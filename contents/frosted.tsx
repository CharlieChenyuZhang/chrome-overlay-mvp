import type { PlasmoCSConfig } from "plasmo"
import React, { useEffect } from "react"
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
const BTN_ID = "__frosted_overlay_toggle_btn__"

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
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  -webkit-font-smoothing: antialiased;
  color: #feffd9;
  font-size: 12px;
  line-height: 15.6px;
  font-weight: 400;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif;
}
.overlay *, .overlay *::before, .overlay *::after { box-sizing: border-box; margin: 0; padding: 0; }
.section.hero.fixed {
  background-color: transparent; color: #121111; width: 100vw; height: 100vh;
  position: fixed; top: 0; left: 0; z-index: 1; pointer-events: none;
}
.n-container.hero { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }
.portfolio-section { position: relative; z-index: 2; margin-top: 40vh; }
.image-overlay-wrap.portfolio { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 60px; padding: 60px 0; position: relative; max-width: 1200px; margin: 0 auto; z-index: 3; transition: all; }
.project-wrapped { display: flex; flex-direction: column; width: 420px; height: auto; text-decoration: none; color: inherit; transition: all; box-shadow: #14120d 0px 2px 5px 0px; position: relative; scroll-snap-align: center; scroll-snap-stop: always; }
.image-overlay-wrap.portfolio > .project-wrapped:nth-child(odd) { transform: matrix(0.99863, 0.052336, -0.052336, 0.99863, 0, 0); }
.image-overlay-wrap.portfolio > .project-wrapped:nth-child(even) { transform: matrix(0.99863, -0.052336, 0.052336, 0.99863, 0, 0); }
.project-cover-wrapper { display: flex; align-items: center; justify-content: center; width: 420px; height: 236px; padding: 0; overflow: hidden; transition: all; }
.project-cover-wrapper.gh { background-color: #f5f2ed; }
.project-cover-wrapper.kori { background-color: #2a2a2a; }
.project-cover-wrapper.kiarra { background-color: #d4b896; }
.project-cover-wrapper.hommage { background-color: #1a1a1a; }
.project-cover-wrapper.agents { background-color: #e8e5e0; }
.project-cover-wrapper.scale { background-color: #2d2d2d; }
.project-cover-wrapper.aura { background-color: #f0f0f0; }
.stretched { display: block; width: 100%; height: 100%; transition: all; }
.stretched img { width: 100%; height: 100%; object-fit: cover; display: block; transition: all 0.3s ease; filter: grayscale(0%); }
.project-description-wrapper { background-color: #feffd9; color: #feffd9; padding: 20px 24px; width: 420px; min-height: 140px; border-radius: 0px; }
.project-description-wrapper h4 { color: #121111; font-size: 10.8px; line-height: 12.96px; text-align: center; font-weight: 400; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
.project-description-wrapper h2 { color: #121111; font-size: 10.8px; line-height: 12.204px; text-align: center; font-weight: 400; margin-bottom: 12px; max-width: 372px; margin-left: auto; margin-right: auto; }
.service-tags { text-align: center; font-size: 10.8px; color: #121111; line-height: 12.96px; }
.project-wrapped:hover .stretched img { filter: grayscale(100%); }
@media (max-width: 1200px) { .image-overlay-wrap.portfolio { padding: 40px 20px; } .project-wrapped { width: 90%; max-width: 420px; } .project-cover-wrapper, .project-description-wrapper { width: 100%; } }
@media (max-width: 480px) { .image-overlay-wrap.portfolio { gap: 40px; padding: 30px 15px; } .project-cover-wrapper { height: 200px; padding: 0; } .stretched { width: 100%; height: auto; max-height: 200px; } .stretched img { width: 100%; height: auto; max-height: 200px; } }
.hero-content { text-align: center; color: #121111; }
.hero-content h1 { font-size: 48px; font-weight: 400; margin-bottom: 20px; letter-spacing: 2px; }
.hero-content p { font-size: 14px; line-height: 20px; max-width: 500px; margin: 0 auto; }
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
      <section className="overlay" role="dialog" aria-modal="true">

        {/* Scrollable project list */}
        <div className="portfolio-section">
          <div className="image-overlay-wrap portfolio">
            <a href="#" className="project-wrapped w-inline-block">
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
