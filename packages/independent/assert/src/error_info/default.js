import { createDetailedMessage } from "./utils/detailed_message.js";
import { comparisonToPath } from "./utils/comparison_to_path.js";
import { valueToString } from "./utils/value_to_string.js";

export const getErrorInfoDefault = (comparison) => {
  const path = comparisonToPath(comparison);
  const { expected, actual } = comparison;
  const expectedValue = valueToString(expected);
  const actualValue = valueToString(actual);

  return {
    message: createDetailedMessage(`unequal values`, {
      found: actualValue,
      expected: expectedValue,
      path,
    }),
  };
};
