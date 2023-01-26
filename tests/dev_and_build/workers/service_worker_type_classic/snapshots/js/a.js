/* globals self */

self.order.push("before-b");
self.importScripts(__v__("/js/b.js"));
self.order.push("after-b");