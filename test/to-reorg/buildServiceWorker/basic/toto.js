/* globals self */

self.order.push("before-foo")
self.importScripts("./foo.js")
self.order.push("after-foo")
