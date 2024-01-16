import { inspectConstructor } from "./constructor.js";

export const inspectStringObject = (
  value,
  { nestedInspect, useNew, parenthesis },
) => {
  const stringSource = nestedhumanize(value.valueOf());

  return inspectConstructor(`String(${stringSource})`, { useNew, parenthesis });
};
