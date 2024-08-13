var _jsxFileName = "base/client/main.jsx";
import { render } from "/@fs@jsenv/core/node_modules/preact/dist/preact.module.js?v=10.23.2";
import { Provider } from "/@fs@jsenv/core/node_modules/react-redux/dist/react-redux.mjs?v=9.1.2";
import { store } from "/store.js";
import { jsxDEV as _jsxDEV } from "/@fs@jsenv/core/node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js?v=1.0.0";
const {
  App
} = await import("/app.jsx");
let resolveRenderPromise;
const renderPromise = new Promise(resolve => {
  resolveRenderPromise = resolve;
});
render(_jsxDEV(Provider, {
  store: store,
  children: _jsxDEV(App, {
    onRender: resolveRenderPromise
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 14,
    columnNumber: 5
  }, this)
}, void 0, false, {
  fileName: _jsxFileName,
  lineNumber: 13,
  columnNumber: 3
}, this), document.querySelector("#app"));
await renderPromise;
// increment
document.querySelector("#increment").click();
await new Promise(resolve => {
  setTimeout(resolve, 100);
});
const spanContentAfterIncrement = document.querySelector("#counter_value").innerHTML;
// decrement
document.querySelector("#decrement").click();
await new Promise(resolve => {
  setTimeout(resolve, 100);
});
const spanContentAfterDecrement = document.querySelector("#counter_value").innerHTML;
// resolve with what we found
window.resolveResultPromise({
  spanContentAfterIncrement,
  spanContentAfterDecrement
});