import { comparisonToPath } from "../comparison_to_path.js";
import { valueToString } from "../value_to_string.js";
import { findSelfOrAncestorComparison } from "../find_self_or_ancestor_comparison.js";

export const mapEntryComparisonToErrorMessage = (comparison) => {
  const mapEntryComparison = findSelfOrAncestorComparison(
    comparison,
    ({ type }) => type === "map-entry",
  );
  if (!mapEntryComparison) return null;

  const isUnexpected =
    !mapEntryComparison.expected && mapEntryComparison.actual;
  if (isUnexpected)
    return createUnexpectedMapEntryErrorMessage(mapEntryComparison);

  const isMissing = mapEntryComparison.expected && !mapEntryComparison.actual;
  if (isMissing) return createMissingMapEntryErrorMessage(mapEntryComparison);

  return null;
};

const createUnexpectedMapEntryErrorMessage = (
  comparison,
) => `an entry is unexpected
--- unexpected entry key ---
${valueToString(comparison.actual.key)}
--- unexpected entry value ---
${valueToString(comparison.actual.value)}
--- path ---
${comparisonToPath(comparison.parent)}`;

const createMissingMapEntryErrorMessage = (comparison) => `an entry is missing
--- missing entry key ---
${valueToString(comparison.expected.key)}
--- missing entry value ---
${valueToString(comparison.expected.value)}
--- path ---
${comparisonToPath(comparison.parent)}`;
