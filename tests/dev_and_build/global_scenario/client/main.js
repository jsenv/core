/* globals __DEV__, __BUILD__ */

window.resolveResultPromise({
  dev: __DEV__,
  build: __BUILD__,
});

// eslint-disable-next-line no-new
new Worker(new URL("./worker.js", window.location));

window.navigator.serviceWorker.register("/sw.js");
