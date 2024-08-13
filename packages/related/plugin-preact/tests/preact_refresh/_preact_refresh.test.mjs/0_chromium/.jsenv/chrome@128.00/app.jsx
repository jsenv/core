import { createImportMetaHot } from "/@fs@jsenv/core/src/plugins/import_meta_hot/client/import_meta_hot.js";
import.meta.hot = createImportMetaHot(import.meta.url);
import { installPreactRefresh } from "/@fs@jsenv/core/packages/related/plugin-preact/src/client/preact_refresh.js";
const __preact_refresh__ = installPreactRefresh("base/git_ignored/app.jsx");
var _jsxFileName = "base/git_ignored/app.jsx",
  _s = $RefreshSig$();
import { addHookName } from "/@fs@jsenv/core/node_modules/preact/devtools/dist/devtools.module.js?v=1.0.0";
import { useState } from "/@fs@jsenv/core/node_modules/preact/hooks/dist/hooks.module.js?v=0.1.0";
import { CountLabel } from "/count_label.jsx";
import { jsxDEV as _jsxDEV } from "/@fs@jsenv/core/node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js?v=1.0.0";
export const App = () => {
  _s();
  const [count, countSetter] = addHookName(useState(0), "count");
  return _jsxDEV("div", {
    children: [_jsxDEV(CountLabel, {
      count: count
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 10,
      columnNumber: 7
    }, this), _jsxDEV("button", {
      id: "button_increase",
      onClick: () => {
        countSetter(prev => prev + 1);
      },
      children: "+1"
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 11,
      columnNumber: 7
    }, this), _jsxDEV("button", {
      onClick: () => {
        countSetter(prev => prev - 1);
      },
      children: "-1"
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 20,
      columnNumber: 7
    }, this)]
  }, void 0, true, {
    fileName: _jsxFileName,
    lineNumber: 9,
    columnNumber: 5
  }, this);
};
_s(App, "useState{[count, countSetter](0)}");
_c = App;
var _c;
$RefreshReg$(_c, "App");
__preact_refresh__.end();
import.meta.hot.accept(__preact_refresh__.acceptCallback);