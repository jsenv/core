import { humanize } from "@jsenv/humanize";

export const propertyToAccessorString = (property) => {
  if (typeof property === "number") {
    return `[${humanize(property)}]`;
  }
  if (typeof property === "string") {
    const dotNotationAllowedForProperty =
      propertyNameToDotNotationAllowed(property);
    if (dotNotationAllowedForProperty) {
      return `.${property}`;
    }
    return `[${humanize(property)}]`;
  }

  return `[${symbolToWellKnownSymbol(property)}]`;
};

const propertyNameToDotNotationAllowed = (propertyName) => {
  return (
    /^[a-z_$]+[0-9a-z_&]$/i.test(propertyName) ||
    /^[a-z_$]$/i.test(propertyName)
  );
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#Well-known_symbols
const symbolToWellKnownSymbol = (symbol) => {
  const wellKnownSymbolName = Object.getOwnPropertyNames(Symbol).find(
    (name) => symbol === Symbol[name],
  );
  if (wellKnownSymbolName) {
    return `Symbol${propertyToAccessorString(wellKnownSymbolName)}`;
  }

  const description = symbolToDescription(symbol);
  if (description) {
    const key = Symbol.keyFor(symbol);
    if (key) {
      return `Symbol.for(${humanize(description)})`;
    }
    return `Symbol(${humanize(description)})`;
  }
  return `Symbol()`;
};

const symbolToDescription = (symbol) => {
  const toStringResult = symbol.toString();
  const openingParenthesisIndex = toStringResult.indexOf("(");
  const closingParenthesisIndex = toStringResult.indexOf(")");
  return toStringResult.slice(
    openingParenthesisIndex + 1,
    closingParenthesisIndex,
  );
  // return symbol.description // does not work on node
};
