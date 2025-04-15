import { url } from "http://127.0.0.1/file.js";
import { answer } from "/js/dep.js";

window.resolveResultPromise({
  url: url.replace(window.origin, "window.origin"),
  answer,
});