self.importScripts("foo")

self.addEventListener("message", (e) => {
  if (e.data === "ping") {
    self.postMessage(self.answer)
  }
})
