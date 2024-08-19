import { url } from "http://127.0.0.1:9999/file.js";
import { answer } from "./dep.js";

window.resolveResultPromise({
  url: url.replace(window.origin, "window.origin"),
  answer,
});
