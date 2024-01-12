import { comparisonToPath } from "./utils/comparison_to_path.js";
import { valueToString } from "./utils/value_to_string.js";

export const getMatchesRegExpErrorInfo = (comparison) => {
  if (comparison.type !== "matches_reg_exp") {
    return null;
  }

  const path = comparisonToPath(comparison);
  const actualValue = valueToString(comparison.actual);
  const expectedRegexp = valueToString(comparison.expected);
  return {
    type: "RegexpMismatchAssertionError",
    message: `unexpected value
--- found ---
${actualValue}
--- expected ---
matchesRegExp(${expectedRegexp})
--- path ---
${path}`,
  };
};
