/* eslint-env serviceworker */

self.importScripts("../../../../src/jsenv_service_worker.js");

// do not enable install/activate instrumentation during tests
// to keep them simpler
let installInstrumentation = false;
let activateInstrumentation = false;

let _resolveInstallPromise;
let _rejectInstallPromise;
const installPromise = new Promise((resolve, reject) => {
  _resolveInstallPromise = resolve;
  _rejectInstallPromise = reject;
});
self.__sw__.registerActions({
  resolve_install: _resolveInstallPromise,
  reject_instal: _rejectInstallPromise,
});
let _resolveActivatePromise;
let _rejectActivatePromise;
const activatePromise = new Promise((resolve, reject) => {
  _resolveActivatePromise = resolve;
  _rejectActivatePromise = reject;
});
self.__sw__.registerActions({
  resolve_activate: _resolveActivatePromise,
  reject_activate: _rejectActivatePromise,
});

self.__sw__.init({
  logLevel: "debug",
  name: self.NAME || "dog",
  resources: {
    "/": {},
    ...(self.resourcesFromJsenvBuild || {}),
  },
  meta: {
    installInstrumentation,
    activateInstrumentation,
  },
  install: () => (installInstrumentation ? installPromise : null),
  activate: () => (activateInstrumentation ? activatePromise : null),
});
