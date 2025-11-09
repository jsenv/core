import { render } from "/js/preact.mjs";
import { jsx as _jsx } from "/js/jsxRuntime.mjs";
const {
  App
} = await import(__v__("/js/app.js"));
render(_jsx(App, {}), document.querySelector("#app"));
window.resolveResultPromise({
  spanContent: document.querySelector("#app span").innerHTML
});