import { useEffect } from "/js/react.js?cjs_as_js_module=";
import { jsx as _jsx } from "/js/react/jsx-runtime.js?cjs_as_js_module=";
export const Root = ({
  onRender
}) => {
  useEffect(() => {
    onRender();
  }, []);
  return /*#__PURE__*/_jsx("span", {
    children: "Hello world"
  });
};