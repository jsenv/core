import { humanize } from "@jsenv/humanize";

import { valueToWellKnown } from "./well_known_value.js";

export const valueToString = (value) => {
  return valueToWellKnown(value) || humanize(value);
};
