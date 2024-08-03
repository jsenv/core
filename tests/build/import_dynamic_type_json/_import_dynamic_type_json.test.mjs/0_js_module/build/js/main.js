const namespace = await import("/js/data.json.js?debug", {
  with: {  },
});

window.resolveResultPromise(namespace.default);
