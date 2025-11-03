import { signal } from "@preact/signals";

const renderSignal = signal(null);
const forceRender = () => {
  renderSignal.value = {}; // force re-render
};

export const useForceRender = () => {
  // eslint-disable-next-line no-unused-expressions
  renderSignal.value;
  return forceRender;
};

// import { useState } from "preact/hooks";

// export const useForceRender = () => {
//   const [, setState] = useState(null);
//   return () => {
//     setState({});
//   };
// };
