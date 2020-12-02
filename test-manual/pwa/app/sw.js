/* globals self, config */

self.importScripts("../../../src/sw.preconfig.js")

config.cacheName = "toto"
config.extraUrlsToCacheOnInstall = ["/", "file.txt"]
config.shouldReloadOnInstall = (response, request) =>
  config.extraUrlsToCacheOnInstall.some(
    (url) => String(new URL(url, self.location)) === request.url,
  )

self.importScripts("../../../src/sw.jsenv.js")
