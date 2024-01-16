import { humanize } from "@jsenv/humanize";

import { comparisonToPath } from "./utils/comparison_to_path.js";

export const getPropertiesOrderErrorInfo = (comparison) => {
  if (comparison.type !== "properties-order") {
    return null;
  }

  const path = comparisonToPath(comparison);
  const expected = comparison.expected;
  const actual = comparison.actual;
  return {
    type: "PropertiesOrderAssertionError",
    message: `unexpected properties order
--- properties order found ---
${propertyNameArrayToString(actual).join("\n")}
--- properties order expected ---
${propertyNameArrayToString(expected).join("\n")}
--- path ---
${path}`,
  };
};

const propertyNameArrayToString = (propertyNameArray) => {
  return propertyNameArray.map((propertyName) => humanize(propertyName));
};
