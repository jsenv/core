import { answer } from "./file.js";

setTimeout(() => {
  const url = import.meta.url;
  window.resolveResultPromise({
    answer,
    url: url.replace(window.origin, "window.origin"),
  });
}, 100);
