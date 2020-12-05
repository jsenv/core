/* globals self, config */

self.importScripts("../../../node_modules/@jsenv/pwa/src/service-worker.setup.js")

config.cacheName = "toto"
config.urlMap = { "/": "main.html" }
config.extraUrlsToCacheOnInstall = ["file.txt"]

self.importScripts("../../../node_modules/@jsenv/pwa/src/service-worker.main.js")
