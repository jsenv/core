import { p as ping } from "/js/ping.js?v=a769b325";

/* globals self */

self.addEventListener("message", function (e) {
  if (e.data === "ping") {
    self.postMessage(ping);
  }
});
