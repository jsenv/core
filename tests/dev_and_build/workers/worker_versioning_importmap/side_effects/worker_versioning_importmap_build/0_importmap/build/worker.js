import { ping } from "/js/ping.js?v=1ecb6f99";

self.addEventListener("message", function (e) {
  if (e.data === "ping") {
    self.postMessage(ping);
  }
});
