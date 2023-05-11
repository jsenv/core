import { useState } from "react";

import { CountLabel } from "./count_label.jsx";

export const App = () => {
  const [count, countSetter] = useState(0);

  return (
    <div>
      <CountLabel count={count} />
      <button
        id="button_increase"
        onClick={() => {
          countSetter((prev) => prev + 1);
        }}
      >
        +1
      </button>

      <button
        onClick={() => {
          countSetter((prev) => prev - 1);
        }}
      >
        -1
      </button>
    </div>
  );
};
