const namespace = await import("/js/data.json.js?debug", {
  assert: {  },
});

window.resolveResultPromise(namespace.default);
