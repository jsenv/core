import { createDetailedMessage } from "../detailed_message.js";
import { comparisonToPath } from "../comparison_to_path.js";
import { valueToString } from "../value_to_string.js";

export const defaultComparisonToErrorMessage = (comparison) => {
  const path = comparisonToPath(comparison);
  const { expected, actual } = comparison;
  const expectedValue = valueToString(expected);
  const actualValue = valueToString(actual);

  return createDetailedMessage(`unequal values`, {
    found: actualValue,
    expected: expectedValue,
    path,
  });
};
