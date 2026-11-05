const namespace = await import("/js/data.json.js?debug");

window.resolveResultPromise(namespace.default);