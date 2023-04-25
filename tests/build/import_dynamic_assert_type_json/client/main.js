const namespace = await import("./data.json?debug", {
  assert: { type: "json" },
})

window.resolveResultPromise(namespace.default)
