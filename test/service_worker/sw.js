/* globals self, importScripts */

self.order = []

self.jsenvBuildUrlsValue = self.jsenvBuildUrls

self.order.push("before-a")
importScripts("./a.js")
self.order.push("after-a")
