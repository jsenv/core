import { humanize } from "@jsenv/humanize";

import { isArray } from "../utils/object_subtype.js";
import { createDetailedMessage } from "./utils/detailed_message.js";
import { comparisonToPath } from "./utils/comparison_to_path.js";

export const getArrayLengthErrorInfo = (comparison) => {
  if (comparison.type !== "identity") {
    return null;
  }
  const parentComparison = comparison.parent;
  if (parentComparison.type !== "property-value") {
    return null;
  }
  if (parentComparison.data !== "length") {
    return null;
  }
  const grandParentComparison = parentComparison.parent;
  if (!isArray(grandParentComparison.actual)) {
    return null;
  }

  const actualArray = grandParentComparison.actual;
  const expectedArray = grandParentComparison.expected;
  const actualLength = comparison.actual;
  const expectedLength = comparison.expected;
  const path = comparisonToPath(grandParentComparison);

  if (actualLength < expectedLength) {
    const missingValues = expectedArray.slice(actualLength);
    return {
      type: "MissingArrayEntryAssertionError",
      message: createDetailedMessage(`an array is smaller than expected`, {
        "array length found": actualLength,
        "array length expected": expectedLength,
        "missing values": humanize(missingValues),
        path,
      }),
    };
  }

  const extraValues = actualArray.slice(expectedLength);
  return {
    type: "ExtraArrayEntryAssertionError",
    message: createDetailedMessage(`an array is bigger than expected`, {
      "array length found": actualLength,
      "array length expected": expectedLength,
      "extra values": humanize(extraValues),
      path,
    }),
  };
};
