import { createImportMetaHot } from "/@fs@jsenv/core/src/plugins/import_meta_hot/client/import_meta_hot.js";
import.meta.hot = createImportMetaHot(import.meta.url);
import { installPreactRefresh } from "/@fs@jsenv/core/packages/related/plugin-preact/src/client/preact_refresh.js";
const __preact_refresh__ = installPreactRefresh("base/git_ignored/count_label.jsx");
var _jsxFileName = "base/git_ignored/count_label.jsx";
import { label } from "/label.js?hot=1723533367649";
import { jsxDEV as _jsxDEV } from "/@fs@jsenv/core/node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js?v=1.0.0";
export const CountLabel = ({
  count
}) => {
  return _jsxDEV("span", {
    id: "count_label",
    style: "color: black",
    children: [label, ": ", count]
  }, void 0, true, {
    fileName: _jsxFileName,
    lineNumber: 5,
    columnNumber: 5
  }, this);
};
_c = CountLabel;
var _c;
$RefreshReg$(_c, "CountLabel");
__preact_refresh__.end();
import.meta.hot.accept(__preact_refresh__.acceptCallback);