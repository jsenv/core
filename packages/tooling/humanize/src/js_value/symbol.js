export const inspectSymbol = (value, { nestedHumanize, parenthesis }) => {
  const symbolDescription = symbolToDescription(value);
  const symbolDescriptionSource = symbolDescription
    ? nestedHumanize(symbolDescription)
    : "";
  const symbolSource = `Symbol(${symbolDescriptionSource})`;

  if (parenthesis) return `${symbolSource}`;
  return symbolSource;
};

const symbolToDescription =
  "description" in Symbol.prototype
    ? (symbol) => symbol.description
    : (symbol) => {
        const toStringResult = symbol.toString();
        const openingParenthesisIndex = toStringResult.indexOf("(");
        const closingParenthesisIndex = toStringResult.indexOf(")");
        const symbolDescription = toStringResult.slice(
          openingParenthesisIndex + 1,
          closingParenthesisIndex,
        );
        return symbolDescription;
      };
