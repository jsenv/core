import { useEffect } from "preact/hooks";
import { useDispatch, useSelector } from "react-redux";

import { decrement, increment } from "./counter/counter_action.js";
import { counterValueSelector } from "./counter/counter_selectors.js";

export const App = ({ onRender }) => {
  const counterValue = useSelector(counterValueSelector);
  const dispatch = useDispatch();

  useEffect(() => {
    onRender();
  }, []);

  return (
    <p>
      <button
        id="increment"
        onClick={() => {
          dispatch(increment());
        }}
      >
        +1
      </button>
      <button
        id="decrement"
        onClick={() => {
          dispatch(decrement());
        }}
      >
        -1
      </button>
      <span id="counter_value">{counterValue}</span>
    </p>
  );
};
