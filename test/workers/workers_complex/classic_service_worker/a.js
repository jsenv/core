/* globals self */

self.order.push("before-b")
self.importScripts("./b.js")
self.order.push("after-b")
