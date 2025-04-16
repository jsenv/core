import { isDotNotationAllowed } from "./property_identifier.js";

export const createValuePath = (parts = []) => {
  return {
    parts,
    [Symbol.iterator]() {
      return parts[Symbol.iterator]();
    },
    toString: () => parts.map((part) => part.value).join(""),
    valueOf: () => parts.map((part) => part.value).join(""),
    pop: () => {
      return createValuePath(parts.slice(1));
    },
    append: (
      property,
      { isIndexedEntry, isPropertyDescriptor, isMeta } = {},
    ) => {
      let propertyKey = "";
      let propertyKeyCanUseDot = false;
      if (isIndexedEntry) {
        propertyKey = `[${property}]`;
      } else if (typeof property === "symbol") {
        propertyKey = humanizeSymbol(property);
      } else if (typeof property === "string") {
        if (
          // first "property" is a "global" variable name that does not need to be wrapped
          // in quotes
          parts.length === 0 ||
          isDotNotationAllowed(property)
        ) {
          propertyKey = property;
          propertyKeyCanUseDot = true;
        } else {
          propertyKey = `"${property}"`; // TODO: property escaping
        }
      } else {
        propertyKey = String(property);
        propertyKeyCanUseDot = true;
      }
      if (parts.length === 0) {
        return createValuePath([
          {
            type: "identifier",
            value: propertyKey,
          },
        ]);
      }
      if (isPropertyDescriptor || isMeta) {
        return createValuePath([
          ...parts,
          { type: "property_open_delimiter", value: "[[" },
          { type: "property_identifier", value: propertyKey },
          { type: "property_close_delimiter", value: "]]" },
        ]);
      }
      if (propertyKeyCanUseDot) {
        return createValuePath([
          ...parts,
          { type: "property_dot", value: "." },
          { type: "property_identifier", value: propertyKey },
        ]);
      }
      return createValuePath([
        ...parts,
        { type: "property_open_delimiter", value: "[" },
        { type: "property_identifier", value: propertyKey },
        { type: "property_close_delimiter", value: "]" },
      ]);
    },
  };
};

const humanizeSymbol = (symbol) => {
  const description = symbolToDescription(symbol);
  if (description) {
    const key = Symbol.keyFor(symbol);
    if (key) {
      return `Symbol.for(${description})`;
    }
    return `Symbol(${description})`;
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
