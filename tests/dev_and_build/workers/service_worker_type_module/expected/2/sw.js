
self.serviceWorkerUrls = {
  "/main.html": {
    "versioned": false,
    "version": "1ee5fe50"
  },
  "/css/style.css?v=0e312da1": {
    "versioned": true
  },
  "/js/a.js?v=9c2ce306": {
    "versioned": true
  },
  "/js/b.js?v=e3b0c442": {
    "versioned": true
  }
};
/* globals self */

import "/js/a.js?v=9c2ce306"

self.order = []

self.addEventListener("message", async (messageEvent) => {
  if (messageEvent.data === "inspect") {
    messageEvent.ports[0].postMessage({
      order: self.order,
      serviceWorkerUrls: self.serviceWorkerUrls,
    })
  }
})

// trigger jsenv dynamic import for slicedToArray
const fn = ([a]) => {
  console.log(a)
}
fn(["a"])
