

window.resolveResultPromise({
  dev: false,
  build: true,
});


new Worker(new URL("/worker.js", window.location));

window.navigator.serviceWorker.register("/sw.js");