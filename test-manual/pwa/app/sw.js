/* globals self */

self.importScripts("../../../node_modules/@jsenv/pwa/src/service-worker.setup.js")

self.config.cachePrefix = "toto"
self.config.logLevel = "debug"

self.importScripts("../../../node_modules/@jsenv/pwa/src/service-worker.main.js")
