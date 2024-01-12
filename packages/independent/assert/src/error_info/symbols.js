import { inspect } from "@jsenv/inspect";

import { comparisonToPath } from "./utils/comparison_to_path.js";

export const getSymbolsErrorInfo = (comparison) => {
  if (comparison.type !== "symbols") {
    return null;
  }

  const path = comparisonToPath(comparison);
  const extra = comparison.actual.extra;
  const missing = comparison.actual.missing;
  const hasExtra = extra.length > 0;
  const hasMissing = missing.length > 0;

  if (hasExtra && !hasMissing) {
    return {
      type: "ExtraSymbolAssertionError",
      message: `unexpected symbols
--- unexpected symbol list ---
${symbolArrayToString(extra).join("\n")}
--- path ---
${path}`,
    };
  }

  if (!hasExtra && hasMissing) {
    return {
      type: "MissingSymbolAssertionError",
      message: `missing symbols
--- missing symbol list ---
${symbolArrayToString(missing).join("\n")}
--- path ---
${path}`,
    };
  }

  return {
    type: "SymbolAssertionError",
    message: `unexpected and missing symbols
--- unexpected symbol list ---
${symbolArrayToString(extra).join("\n")}
--- missing symbol list ---
${symbolArrayToString(missing).join("\n")}
--- path ---
${path}`,
  };
};

const symbolArrayToString = (symbolArray) => {
  return symbolArray.map((symbol) => inspect(symbol));
};
