import { inspectConstructor } from "./constructor.js";

export const inspectBooleanObject = (
  value,
  { nestedInspect, useNew, parenthesis },
) => {
  const booleanSource = nestedhumanize(value.valueOf());
  return inspectConstructor(`Boolean(${booleanSource})`, {
    useNew,
    parenthesis,
  });
};
