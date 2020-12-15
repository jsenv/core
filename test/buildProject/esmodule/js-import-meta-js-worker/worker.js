/* globals self */
self.importScripts("./dep.js")

self.addEventListener("message", (e) => {
  if (e.data === "ping") {
    self.postMessage(self.pingResponse)
  }
})
