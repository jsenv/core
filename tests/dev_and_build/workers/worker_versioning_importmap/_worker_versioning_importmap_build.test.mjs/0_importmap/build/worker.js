import { ping } from "/js/ping.js?v=44968be0";

self.addEventListener("message", function (e) {
  if (e.data === "ping") {
    self.postMessage(ping);
  }
});