import { comparisonToPath } from "../comparison_to_path.js";
import { valueToString } from "../value_to_string.js";

export const matchesRegExpToErrorMessage = (comparison) => {
  if (comparison.type !== "matchesRegExp") {
    return undefined;
  }

  const path = comparisonToPath(comparison);
  const actualValue = valueToString(comparison.actual);
  const expectedRegexp = valueToString(comparison.expected);

  return createMatchesRegExpMessage({ path, actualValue, expectedRegexp });
};

const createMatchesRegExpMessage = ({
  path,
  expectedRegexp,
  actualValue,
}) => `unexpected value
--- found ---
${actualValue}
--- expected ---
matchesRegExp(${expectedRegexp})
--- path ---
${path}`;
