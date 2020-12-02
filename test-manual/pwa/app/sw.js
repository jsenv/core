/* globals self, config */

self.importScripts("../../../src/sw.preconfig.js")

config.cacheName = "toto"
config.extraUrlsToCacheOnInstall = ["file.txt"]

self.importScripts("../../../src/sw.jsenv.js")
