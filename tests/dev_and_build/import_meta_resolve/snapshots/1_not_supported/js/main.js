function _await(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }
  if (!value || !value.then) {
    value = Promise.resolve(value);
  }
  return then ? value.then(then) : value;
}
const importMetaResolveReturnValue = new URL("/js/foo.js", import.meta.url).href;
const script = document.createElement("script");
script.src = importMetaResolveReturnValue;
const scriptLoadPromise = new Promise(resolve => {
  script.onload = () => {
    resolve();
  };
});
document.head.appendChild(script);
_await(scriptLoadPromise, function () {
  window.resolveResultPromise({
    importMetaResolveReturnValue,
    __TEST__: window.__TEST__
  });
});