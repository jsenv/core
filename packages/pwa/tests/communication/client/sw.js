self.addEventListener("message", async ({ data, ports }) => {
  if (data === "ping") {
    ports[0].postMessage("pong")
  }
})
