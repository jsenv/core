import { comparisonToPath } from "./utils/comparison_to_path.js";
import { valueToString } from "./utils/value_to_string.js";

export const getAnyErrorInfo = (comparison) => {
  if (comparison.type !== "any") {
    return null;
  }

  const path = comparisonToPath(comparison);
  const actualValue = valueToString(comparison.actual);
  const expectedConstructor = comparison.expected;
  return {
    type: "AnyAssertionError",
    message: createAnyMessage({
      path,
      expectedConstructor,
      actualValue,
    }),
  };
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
