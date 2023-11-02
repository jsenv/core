import { Fragment } from "preact";
import { useState } from "preact/hooks";

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
