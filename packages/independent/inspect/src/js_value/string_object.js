import { inspectConstructor } from "./constructor.js";

export const inspectStringObject = (
  value,
  { nestedInspect, useNew, parenthesis },
) => {
  const stringSource = nestedInspect(value.valueOf());

  return inspectConstructor(`String(${stringSource})`, { useNew, parenthesis });
};
