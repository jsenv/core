const importMetaResolveReturnValue = import.meta.resolve("/js/foo.js");

const script = document.createElement("script");
script.src = importMetaResolveReturnValue;
const scriptLoadPromise = new Promise((resolve) => {
  script.onload = () => {
    resolve();
  };
});
document.head.appendChild(script);

await scriptLoadPromise;

window.resolveResultPromise({
  importMetaResolveReturnValue: importMetaResolveReturnValue.replace(
    window.origin,
    "window.origin",
  ),
  __TEST__: window.__TEST__.replace(window.origin, "window.origin"),
});
