window.resolveResultPromise(
  new URL("./file.txt", import.meta.url).href.replace(
    window.origin,
    "window.origin",
  ),
);
