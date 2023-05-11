import { inspect } from "@jsenv/inspect";
import { comparisonToPath } from "../comparisonToPath.js";

export const symbolsOrderComparisonToErrorMessage = (comparison) => {
  if (comparison.type !== "symbols-order") return undefined;

  const path = comparisonToPath(comparison);
  const expected = comparison.expected;
  const actual = comparison.actual;

  return createUnexpectedSymbolsOrderMessage({
    path,
    expectedSymbolsOrder: symbolArrayToString(expected),
    actualSymbolsOrder: symbolArrayToString(actual),
  });
};

const createUnexpectedSymbolsOrderMessage = ({
  path,
  expectedSymbolsOrder,
  actualSymbolsOrder,
}) => `unexpected symbols order
--- symbols order found ---
${actualSymbolsOrder.join(`
`)}
--- symbols order expected ---
${expectedSymbolsOrder.join(`
`)}
--- path ---
${path}`;

const symbolArrayToString = (symbolArray) => {
  return symbolArray.map((symbol) => inspect(symbol));
};
