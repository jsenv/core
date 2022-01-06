/* globals self */

// eslint-disable-next-line import/no-unresolved
import { value } from "./bar.js"

self.addEventListener("message", (e) => {
  if (e.data === "ping") {
    self.postMessage(value)
  }
})
