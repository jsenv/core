/* globals self */

// eslint-disable-next-line import/no-unresolved
import { value } from "foo"

self.addEventListener("message", (e) => {
  if (e.data === "inspect") {
    e.ports[0].postMessage(value)
  }
})
