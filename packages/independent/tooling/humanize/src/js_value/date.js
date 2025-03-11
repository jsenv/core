import { inspectConstructor } from "./constructor.js";

export const inspectDate = (value, { nestedHumanize, useNew, parenthesis }) => {
  const dateSource = nestedHumanize(value.valueOf(), {
    numericSeparator: false,
  });
  return inspectConstructor(`Date(${dateSource})`, { useNew, parenthesis });
};
