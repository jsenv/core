
self.serviceWorkerUrls = {
  "/main.html": {
    "versioned": false,
    "version": "37eb36a2"
  },
  "/css/style.css?v=65c914e7": {
    "versioned": true
  },
  "/js/a.js?v=07327beb": {
    "versioned": true
  },
  "/js/b.js?v=2cc2d9e4": {
    "versioned": true
  }
};
;(function(){var m = {"/js/a.js":"/js/a.js?v=07327beb","/js/b.js":"/js/b.js?v=2cc2d9e4"}; self.__v__ = function (s) { return m[s] || s }; })();self.order=[],self.order.push("before-a"),importScripts(__v__("/js/a.js")),self.order.push("after-a"),self.addEventListener("message",(async e=>{"inspect"===e.data&&e.ports[0].postMessage({order:self.order,serviceWorkerUrls:self.serviceWorkerUrls})}));const fn=([e])=>{console.log(e)};fn(["a"]);