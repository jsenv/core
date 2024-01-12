import { comparisonToPath } from "./utils/comparison_to_path.js";
import { valueToString } from "./utils/value_to_string.js";
import { findSelfOrAncestorComparison } from "./utils/find_self_or_ancestor_comparison.js";

export const getMapEntryErrorInfo = (comparison) => {
  const mapEntryComparison = findSelfOrAncestorComparison(
    comparison,
    ({ type }) => type === "map-entry",
  );
  if (!mapEntryComparison) {
    return null;
  }

  const isMissing = mapEntryComparison.expected && !mapEntryComparison.actual;
  if (isMissing) {
    return {
      type: "MissingMapEntryAssertionError",
      message: `an entry is missing
--- missing entry key ---
${valueToString(mapEntryComparison.expected.key)}
--- missing entry value ---
${valueToString(mapEntryComparison.expected.value)}
--- path ---
${comparisonToPath(mapEntryComparison.parent)}`,
    };
  }

  const isUnexpected =
    !mapEntryComparison.expected && mapEntryComparison.actual;
  if (isUnexpected) {
    return {
      type: "ExtraMapEntryAssertionError",
      message: `an entry is unexpected
--- unexpected entry key ---
${valueToString(mapEntryComparison.actual.key)}
--- unexpected entry value ---
${valueToString(mapEntryComparison.actual.value)}
--- path ---
${comparisonToPath(mapEntryComparison.parent)}`,
    };
  }

  return null;
};
