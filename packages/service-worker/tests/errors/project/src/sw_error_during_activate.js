/* eslint-env serviceworker */

self.importScripts("../../../../src/jsenv_service_worker.js")

// eslint-disable-next-line no-unreachable
self.__sw__.init({
  logLevel: "debug",
  name: self.NAME,
  resources: {
    "/": {},
    ...(self.resourcesFromJsenvBuild || {}),
  },
  activate: () => {
    throw new Error("activate error")
  },
})
