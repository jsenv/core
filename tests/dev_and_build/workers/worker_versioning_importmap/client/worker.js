import { ping } from "./ping.js";

self.addEventListener("message", function (e) {
  if (e.data === "ping") {
    self.postMessage(ping);
  }
});
