/* globals self */

self.addEventListener("message", async ({ data, ports }) => {
  if (data === "ping") {
    ports[0].postMessage({ status: "resolved", value: "pong" })
  }
})
