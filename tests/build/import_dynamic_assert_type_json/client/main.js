const namespace = await import("./data.json", { assert: { type: "json" } })

window.resolveResultPromise({
  data: namespace.default,
})
