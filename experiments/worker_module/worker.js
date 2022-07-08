/* globals self */

import { PING_RESPONSE } from "./constants.js"

self.addEventListener("message", (e) => {
  if (e.data === "ping") {
    self.postMessage(PING_RESPONSE)
  }
})
