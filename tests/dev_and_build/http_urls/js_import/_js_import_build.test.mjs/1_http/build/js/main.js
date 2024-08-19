import { url } from "/js/file.js";
import { answer } from "/js/dep.js";

window.resolveResultPromise({
  url: url.replace(window.origin, "window.origin"),
  answer,
});
