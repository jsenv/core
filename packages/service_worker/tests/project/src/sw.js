/* eslint-env serviceworker */

self.importScripts("../../../src/jsenv_service_worker.js")

let installInstrumentation = true
let _resolveInstallPromise
let _rejectInstallPromise
const installPromise = new Promise((resolve, reject) => {
  _resolveInstallPromise = resolve
  _rejectInstallPromise = reject
})
self.__sw__.registerActions({
  resolve_install: _resolveInstallPromise,
  reject_instal: _rejectInstallPromise,
})
let activateInstrumentation = true
let _resolveActivatePromise
let _rejectActivatePromise
const activatePromise = new Promise((resolve, reject) => {
  _resolveActivatePromise = resolve
  _rejectActivatePromise = reject
})
self.__sw__.registerActions({
  resolve_activate: _resolveActivatePromise,
  reject_activate: _rejectActivatePromise,
})

self.__sw__.init({
  cachePrefix: "test",
  version: "1",
  resources: {
    "/": {},
    ...(self.resourcesFromJsenvBuild || {}),
  },
  meta: {
    installInstrumentation,
    activateInstrumentation,
  },
  install: () => installPromise,
  activate: () => activatePromise,
})
