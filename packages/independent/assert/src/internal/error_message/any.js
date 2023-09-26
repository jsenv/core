import { comparisonToPath } from "../comparison_to_path.js";
import { valueToString } from "../value_to_string.js";

export const anyComparisonToErrorMessage = (comparison) => {
  if (comparison.type !== "any") return undefined;

  const path = comparisonToPath(comparison);
  const actualValue = valueToString(comparison.actual);
  const expectedConstructor = comparison.expected;

  return createAnyMessage({ path, expectedConstructor, actualValue });
};

const createAnyMessage = ({
  path,
  expectedConstructor,
  actualValue,
}) => `unexpected value
--- found ---
${actualValue}
--- expected ---
any(${expectedConstructor.name})
--- path ---
${path}`;
