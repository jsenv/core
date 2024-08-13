var _jsxFileName = "base/client/app.jsx";
import { useEffect } from "/@fs@jsenv/core/node_modules/preact/hooks/dist/hooks.module.js?v=0.1.0";
import { useDispatch, useSelector } from "/@fs@jsenv/core/node_modules/react-redux/dist/react-redux.mjs?v=9.1.2";
import { decrement, increment } from "/counter/counter_action.js";
import { counterValueSelector } from "/counter/counter_selectors.js";
import { jsxDEV as _jsxDEV } from "/@fs@jsenv/core/node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js?v=1.0.0";
export const App = ({
  onRender
}) => {
  const counterValue = useSelector(counterValueSelector);
  const dispatch = useDispatch();
  useEffect(() => {
    onRender();
  }, []);
  return _jsxDEV("p", {
    children: [_jsxDEV("button", {
      id: "increment",
      onClick: () => {
        dispatch(increment());
      },
      children: "+1"
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 17,
      columnNumber: 7
    }, this), _jsxDEV("button", {
      id: "decrement",
      onClick: () => {
        dispatch(decrement());
      },
      children: "-1"
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 25,
      columnNumber: 7
    }, this), _jsxDEV("span", {
      id: "counter_value",
      children: counterValue
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 33,
      columnNumber: 7
    }, this)]
  }, void 0, true, {
    fileName: _jsxFileName,
    lineNumber: 16,
    columnNumber: 5
  }, this);
};