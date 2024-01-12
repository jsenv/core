import { comparisonToPath } from "./utils/comparison_to_path.js";
import { valueToString } from "./utils/value_to_string.js";

export const getReferenceErrorInfo = (comparison) => {
  if (comparison.type !== "reference") {
    return null;
  }

  const { actual, expected } = comparison;
  const isMissing = expected && !actual;
  const isExtra = !expected && actual;
  const path = comparisonToPath(comparison);

  if (isExtra) {
    return {
      type: "ExtraReferenceAssertionError",
      message: `found a reference instead of a value
--- reference found to ---
${comparisonToPath(actual, "actual")}
--- value expected ---
${valueToString(comparison.parent.expected)}
--- path ---
${path}`,
    };
  }

  if (isMissing) {
    return {
      type: "MissingReferenceAssertionError",
      message: `found a value instead of a reference
--- value found ---
${valueToString(comparison.parent.actual)}
--- reference expected to ---
${comparisonToPath(expected, "expected")}
--- path ---
${path}`,
    };
  }

  return {
    type: "ReferenceAssertionError",
    message: `unequal references
--- reference found to ---
${comparisonToPath(actual, "actual")}
--- reference expected to ---
${comparisonToPath(expected, "expected")}
--- path ---
${path}`,
  };
};
