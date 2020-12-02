/* globals self, importScripts */

self.order = []

self.order.push("before-toto")
importScripts("./toto.js")
self.order.push("after-toto")

self.hasOwnProperty("nothing")
