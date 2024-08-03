/* globals false, true */

window.resolveResultPromise({
  dev: false,
  build: true,
});

// eslint-disable-next-line no-new
new Worker(new URL("/worker.js", window.location));

window.navigator.serviceWorker.register("/sw.js");
