import { inspect } from "@jsenv/inspect";
import { comparisonToPath } from "../comparisonToPath.js";

export const symbolsComparisonToErrorMessage = (comparison) => {
  if (comparison.type !== "symbols") return undefined;

  const path = comparisonToPath(comparison);
  const extra = comparison.actual.extra;
  const missing = comparison.actual.missing;
  const hasExtra = extra.length > 0;
  const hasMissing = missing.length > 0;

  if (hasExtra && !hasMissing) {
    return createUnexpectedSymbolsMessage({
      path,
      unexpectedSymbols: symbolArrayToString(extra),
    });
  }

  if (!hasExtra && hasMissing) {
    return createMissingSymbolsMessage({
      path,
      missingSymbols: symbolArrayToString(missing),
    });
  }

  return createUnexpectedAndMissingSymbolsMessage({
    path,
    unexpectedSymbols: symbolArrayToString(extra),
    missingSymbols: symbolArrayToString(missing),
  });
};

const createUnexpectedSymbolsMessage = ({
  path,
  unexpectedSymbols,
}) => `unexpected symbols
--- unexpected symbol list ---
${unexpectedSymbols.join(`
`)}
--- path ---
${path}`;

const createMissingSymbolsMessage = ({
  path,
  missingSymbols,
}) => `missing symbols
--- missing symbol list ---
${missingSymbols.join(`
`)}
--- path ---
${path}`;

const createUnexpectedAndMissingSymbolsMessage = ({
  path,
  unexpectedSymbols,
  missingSymbols,
}) => `unexpected and missing symbols
--- unexpected symbol list ---
${unexpectedSymbols.join(`
`)}
--- missing symbol list ---
${missingSymbols.join(`
`)}
--- path ---
${path}`;

const symbolArrayToString = (symbolArray) => {
  return symbolArray.map((symbol) => inspect(symbol));
};
