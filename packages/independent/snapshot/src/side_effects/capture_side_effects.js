import { createCaptureSideEffects } from "./create_capture_side_effects.js";

export const captureSideEffects = (fn, options) => {
  const capture = createCaptureSideEffects(options);
  return capture(fn);
};
