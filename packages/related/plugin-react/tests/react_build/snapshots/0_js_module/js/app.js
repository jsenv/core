import React from "/js/react.js?cjs_as_js_module=";
import ReactDOM from "/js/react-dom/client.js?cjs_as_js_module=";
import { jsx as _jsx } from "/js/react/jsx-runtime.js?cjs_as_js_module=";
const {
  Root
} = await import(__v__("/js/root.js"));
ReactDOM.createRoot(document.querySelector("#app")).render( /*#__PURE__*/_jsx(React.StrictMode, {
  children: /*#__PURE__*/_jsx(Root, {
    onRender: () => {
      window.resolveResultPromise({
        spanContent: document.querySelector("#app span").innerHTML
      });
    }
  })
}));