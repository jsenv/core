import { humanize } from "@jsenv/humanize";

import { createDetailedMessage } from "./utils/detailed_message.js";
import { comparisonToPath } from "./utils/comparison_to_path.js";

export const getBetweenErrorInfo = (comparison) => {
  if (comparison.type !== "between") {
    return null;
  }
  const { actual, expected } = comparison;
  const { min, max } = expected;
  const path = comparisonToPath(comparison);

  // not a number
  if (typeof actual !== "number") {
    return {
      type: "NotANumberAssertionError",
      message: createDetailedMessage(`not a number`, {
        found: humanize(actual),
        expected: `a number between ${humanize(min)} and ${humanize(max)}`,
        path,
      }),
    };
  }
  // too small
  if (actual < min) {
    return {
      type: "TooSmallAssertionError",
      message: createDetailedMessage(`too small`, {
        found: humanize(actual),
        expected: `between ${humanize(min)} and ${humanize(max)}`,
        path,
      }),
    };
  }
  // too big
  return {
    type: "TooBigAssertionError",
    message: createDetailedMessage(`too big`, {
      found: humanize(actual),
      expected: `between ${humanize(min)} and ${humanize(max)}`,
      path,
    }),
  };
};
