const namespace = await import("./data.json?debug", {
  with: { type: "json" },
});

window.resolveResultPromise(namespace.default);
