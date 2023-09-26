import { inspect } from "@jsenv/inspect";

import { valueToWellKnown } from "./well_known_value.js";

export const valueToString = (value) => {
  return valueToWellKnown(value) || inspect(value);
};
