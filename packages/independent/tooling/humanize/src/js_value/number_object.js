import { inspectConstructor } from "./constructor.js";

export const inspectNumberObject = (
  value,
  { nestedHumanize, useNew, parenthesis },
) => {
  const numberSource = nestedHumanize(value.valueOf());
  return inspectConstructor(`Number(${numberSource})`, { useNew, parenthesis });
};
