import { humanize } from "@jsenv/humanize";

import { comparisonToPath } from "./utils/comparison_to_path.js";

export const getSymbolsOrderErrorInfo = (comparison) => {
  if (comparison.type !== "symbols-order") {
    return null;
  }

  const path = comparisonToPath(comparison);
  const expected = comparison.expected;
  const actual = comparison.actual;
  return {
    type: "SymbolsOrderAssertionError",
    message: `unexpected symbols order
--- symbols order found ---
${symbolArrayToString(actual).join("\n")}
--- symbols order expected ---
${symbolArrayToString(expected).join("\n")}
--- path ---
${path}`,
  };
};

const symbolArrayToString = (symbolArray) => {
  return symbolArray.map((symbol) => humanize(symbol));
};
