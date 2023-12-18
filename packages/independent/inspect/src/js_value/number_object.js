import { inspectConstructor } from "./constructor.js";

export const inspectNumberObject = (
  value,
  { nestedInspect, useNew, parenthesis },
) => {
  const numberSource = nestedInspect(value.valueOf());
  return inspectConstructor(`Number(${numberSource})`, { useNew, parenthesis });
};
