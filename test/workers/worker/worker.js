/* globals self */

self.importScripts("./ping.js")

self.addEventListener("message", (e) => {
  if (e.data === "ping") {
    self.postMessage(self.pingResponse)
  }
})
