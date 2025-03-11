import { inspectConstructor } from "./constructor.js";

export const inspectStringObject = (
  value,
  { nestedHumanize, useNew, parenthesis },
) => {
  const stringSource = nestedHumanize(value.valueOf());

  return inspectConstructor(`String(${stringSource})`, { useNew, parenthesis });
};
