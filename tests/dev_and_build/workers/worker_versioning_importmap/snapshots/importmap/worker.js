/* globals self */
import { ping } from "/js/ping.js?v=70ef69dd"

self.addEventListener("message", function (e) {
  if (e.data === "ping") {
    self.postMessage(ping)
  }
})
