window.navigator.serviceWorker.register(
  new URL("./service_worker.js", import.meta.url),
  {
    type: "module",
  },
)
