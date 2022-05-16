/* globals self */

// eslint-disable-next-line import/no-unresolved
import { value } from "foo"

self.addEventListener("message", (e) => {
  if (e.data === "ping") {
    self.postMessage(value)
  }
})
