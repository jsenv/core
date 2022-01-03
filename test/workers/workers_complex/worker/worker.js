/* globals self */

import { pingResponse } from "./ping.js"

self.addEventListener("message", (e) => {
  if (e.data === "ping") {
    self.postMessage(pingResponse)
  }
})
