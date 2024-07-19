import { useState, Fragment } from "react";

export const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <Fragment>
      <button
        id="counter_button"
        type="button"
        onClick={() => setCount((count) => count + 1)}
      >
        Click me
      </button>
      <br />
      number of click: <span id="counter_output">{count}</span>
    </Fragment>
  );
};
