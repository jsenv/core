import { ping } from "/js/ping.js?v=7b8a2158";

self.addEventListener("message", function (e) {
  if (e.data === "ping") {
    self.postMessage(ping);
  }
});
