import { useEffect } from "/js/react.js";
import { jsx as _jsx } from "/js/react/jsx-runtime.js";
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