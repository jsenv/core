import { propertyToAccessorString } from "./propertyToAccessorString.js";

export const comparisonToPath = (comparison, name = "actual") => {
  const comparisonPath = [];

  let ancestor = comparison.parent;
  while (ancestor && ancestor.type !== "root") {
    comparisonPath.unshift(ancestor);
    ancestor = ancestor.parent;
  }
  if (comparison.type !== "root") {
    comparisonPath.push(comparison);
  }

  const path = comparisonPath.reduce((previous, { type, data }) => {
    if (type === "property-enumerable") {
      return `${previous}${propertyToAccessorString(data)}[[Enumerable]]`;
    }
    if (type === "property-configurable") {
      return `${previous}${propertyToAccessorString(data)}[[Configurable]]`;
    }
    if (type === "property-writable") {
      return `${previous}${propertyToAccessorString(data)}[[Writable]]`;
    }
    if (type === "property-get") {
      return `${previous}${propertyToAccessorString(data)}[[Get]]`;
    }
    if (type === "property-set") {
      return `${previous}${propertyToAccessorString(data)}[[Set]]`;
    }
    if (type === "property-value") {
      return `${previous}${propertyToAccessorString(data)}`;
    }
    if (type === "map-entry") {
      return `${previous}[[mapEntry:${data}]]`;
    }
    if (type === "set-entry") {
      return `${previous}[[setEntry:${data}]]`;
    }
    if (type === "reference") {
      return `${previous}`;
    }
    if (type === "integrity") {
      return `${previous}[[Integrity]]`;
    }
    if (type === "extensibility") {
      return `${previous}[[Extensible]]`;
    }
    if (type === "prototype") {
      return `${previous}[[Prototype]]`;
    }
    if (type === "properties") {
      return `${previous}`;
    }
    if (type === "properties-order") {
      return `${previous}`;
    }
    if (type === "symbols") {
      return `${previous}`;
    }
    if (type === "symbols-order") {
      return `${previous}`;
    }
    if (type === "to-string-return-value") {
      return `${previous}.toString()`;
    }
    if (type === "value-of-return-value") {
      return `${previous}.valueOf()`;
    }
    if (type === "identity" || type === "not") {
      return previous;
    }
    if (type === "any" || type === "matchesRegExp") {
      return previous;
    }
    return `${previous} type:${type}, data:${data}`;
  }, name);

  return path;
};
