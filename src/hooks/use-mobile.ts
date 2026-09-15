import * as React from "react"

// Matches Tailwind's `lg` breakpoint so tablets (portrait or landscape) get
// the same overlay sidebar as phones — only actual desktop/laptop widths
// get the push layout.
const MOBILE_BREAKPOINT = 1024

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

// The server has no viewport to measure, so it always reports "not mobile".
// useSyncExternalStore reconciles this against the real client snapshot
// right after mount without triggering a hydration mismatch — unlike a
// useState initializer that reads `window`, which disagrees with the server
// on every load narrower than the breakpoint.
function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
