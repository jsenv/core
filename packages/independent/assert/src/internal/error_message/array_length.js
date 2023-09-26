import { inspect } from "@jsenv/inspect";

import { createDetailedMessage } from "../detailed_message.js";
import { comparisonToPath } from "../comparison_to_path.js";
import { isArray } from "../object_subtype.js";

export const arrayLengthComparisonToMessage = (comparison) => {
  if (comparison.type !== "identity") return undefined;
  const parentComparison = comparison.parent;
  if (parentComparison.type !== "property-value") return undefined;
  if (parentComparison.data !== "length") return undefined;
  const grandParentComparison = parentComparison.parent;
  if (!isArray(grandParentComparison.actual)) return undefined;

  const actualArray = grandParentComparison.actual;
  const expectedArray = grandParentComparison.expected;
  const actualLength = comparison.actual;
  const expectedLength = comparison.expected;
  const path = comparisonToPath(grandParentComparison);

  if (actualLength < expectedLength) {
    const missingValues = expectedArray.slice(actualLength);

    return createDetailedMessage(`an array is smaller than expected`, {
      "array length found": actualLength,
      "array length expected": expectedLength,
      "missing values": inspect(missingValues),
      path,
    });
  }

  const extraValues = actualArray.slice(expectedLength);
  return createDetailedMessage(`an array is bigger than expected`, {
    "array length found": actualLength,
    "array length expected": expectedLength,
    "extra values": inspect(extraValues),
    path,
  });
};
