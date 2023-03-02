console.log({
  ...{ answer: 42 },
})

self.addEventListener("message", function (e) {
  if (e.data === "ping") {
    self.postMessage(42)
  }
})
