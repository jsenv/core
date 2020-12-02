/* globals self, config */

self.importScripts("./sw.preconfig.js")

config.cacheName = "toto"
config.extraUrlsToCacheOnInstall = ["file.txt"]

self.importScripts("./sw.jsenv.js")
