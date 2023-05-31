/* eslint-env serviceworker */

self.importScripts("../../../../src/jsenv_service_worker.js");

throw new Error("register error");

// eslint-disable-next-line no-unreachable
self.__sw__.init({
  logLevel: "debug",
  name: self.NAME,
  resources: {
    "/": {},
    ...(self.resourcesFromJsenvBuild || {}),
  },
});
