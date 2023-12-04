import { inspect } from "@jsenv/inspect";

import { createDetailedMessage } from "../detailed_message.js";
import { comparisonToPath } from "../comparison_to_path.js";

export const betweenComparisonToMessage = (comparison) => {
  if (comparison.type !== "between") return undefined;
  const { actual, expected } = comparison;
  const { min, max } = expected;
  const path = comparisonToPath(comparison);

  // not a number
  if (typeof actual !== "number") {
    return createDetailedMessage(`not a number`, {
      found: inspect(actual),
      expected: `a number between ${inspect(min)} and ${inspect(max)}`,
      path,
    });
  }
  // too small
  if (actual < min) {
    return createDetailedMessage(`too small`, {
      found: inspect(actual),
      expected: `between ${inspect(min)} and ${inspect(max)}`,
      path,
    });
  }
  // too big
  return createDetailedMessage(`too big`, {
    found: inspect(actual),
    expected: `between ${inspect(min)} and ${inspect(max)}`,
    path,
  });
};
