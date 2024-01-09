import { comparisonToPath } from "./utils/comparison_to_path.js";

export const getSetSizeErrorInfo = (comparison) => {
  if (comparison.type !== "set-size") {
    return null;
  }

  if (comparison.actual < comparison.expected) {
    return {
      type: "MissingSetEntryAssertionError",
      message: `a set is smaller than expected
--- set size found ---
${comparison.actual}
--- set size expected ---
${comparison.expected}
--- path ---
${comparisonToPath(comparison.parent)}`,
    };
  }

  if (comparison.actual > comparison.expected) {
    return {
      type: "ExtraSetEntryAssertionError",
      message: `a set is bigger than expected
--- set size found ---
${comparison.actual}
--- set size expected ---
${comparison.expected}
--- path ---
${comparisonToPath(comparison.parent)}`,
    };
  }

  return null;
};
