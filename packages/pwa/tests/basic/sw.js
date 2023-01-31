/* globals self */

self.addEventListener("fetch", () => {})

self.addEventListener("message", ({ data }) => {
  if (data && data.action === "skipWaiting") {
    self.skipWaiting()
  }
})
