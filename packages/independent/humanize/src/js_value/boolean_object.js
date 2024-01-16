import { inspectConstructor } from "./constructor.js";

export const inspectBooleanObject = (
  value,
  { nestedHumanize, useNew, parenthesis },
) => {
  const booleanSource = nestedHumanize(value.valueOf());
  return inspectConstructor(`Boolean(${booleanSource})`, {
    useNew,
    parenthesis,
  });
};
