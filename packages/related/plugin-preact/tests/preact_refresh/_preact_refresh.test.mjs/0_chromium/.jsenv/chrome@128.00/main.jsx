import { createImportMetaHot } from "/@fs@jsenv/core/src/plugins/import_meta_hot/client/import_meta_hot.js";
import.meta.hot = createImportMetaHot(import.meta.url);
var _jsxFileName = "base/git_ignored/main.jsx";
import { render } from "/@fs@jsenv/core/node_modules/preact/dist/preact.module.js?v=10.23.2";
import { jsxDEV as _jsxDEV } from "/@fs@jsenv/core/node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js?v=1.0.0";
const {
  App
} = await import("/app.jsx");
render(_jsxDEV(App, {}, void 0, false, {
  fileName: _jsxFileName,
  lineNumber: 5,
  columnNumber: 8
}, this), document.querySelector("#app"));
if (import.meta.hot) {
  import.meta.hot.accept();
}
window.resolveReadyPromise();