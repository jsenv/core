/* eslint-env serviceworker */

self.importScripts("../../../../src/jsenv_service_worker.js")

self.__sw__.init({
  logLevel: "debug",
  name: self.NAME,
  resources: {
    "/": {},
    ...(self.resourcesFromJsenvBuild || {}),
  },
})
