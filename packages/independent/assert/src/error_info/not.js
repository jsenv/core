import { comparisonToPath } from "./utils/comparison_to_path.js";
import { valueToString } from "./utils/value_to_string.js";

export const getNotErroInfo = (comparison) => {
  if (comparison.type !== "not") {
    return null;
  }

  const path = comparisonToPath(comparison);
  const actualValue = valueToString(comparison.actual);
  return {
    type: "NotAssertionError",
    message: `unexpected value
--- found ---
${actualValue}
--- expected ---
an other value
--- path ---
${path}`,
  };
};
