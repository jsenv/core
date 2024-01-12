import { isComposite } from "../../utils/is_composite.js";
import { propertyToAccessorString } from "./property_to_accessor_string.js";

export const valueToWellKnown = (value) => {
  const compositeWellKnownPath = valueToCompositeWellKnownPath(value);
  if (compositeWellKnownPath) {
    return compositeWellKnownPath
      .slice(1)
      .reduce(
        (previous, property) =>
          `${previous}${propertyToAccessorString(property)}`,
        compositeWellKnownPath[0],
      );
  }
  return null;
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
const compositeWellKnownMap = new WeakMap();
const primitiveWellKnownMap = new Map();

const valueToCompositeWellKnownPath = (value) => {
  return compositeWellKnownMap.get(value);
};

const isPrimitive = (value) => !isComposite(value);

export const addWellKnownComposite = (value, name) => {
  const visitValue = (value, path) => {
    if (isPrimitive(value)) {
      primitiveWellKnownMap.set(value, path);
      return;
    }

    if (compositeWellKnownMap.has(value)) return; // prevent infinite recursion
    compositeWellKnownMap.set(value, path);

    const visitProperty = (property) => {
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, property);
      } catch (e) {
        // may happen if you try to access some iframe properties or stuff like that
        if (e.name === "SecurityError") {
          return;
        }
        throw e;
      }

      if (!descriptor) {
        return;
      }

      // do not trigger getter/setter
      if ("value" in descriptor) {
        const propertyValue = descriptor.value;
        visitValue(propertyValue, [...path, property]);
      }
    };

    Object.getOwnPropertyNames(value).forEach((name) => visitProperty(name));
    Object.getOwnPropertySymbols(value).forEach((symbol) =>
      visitProperty(symbol),
    );
  };

  visitValue(value, [name]);
};

if (typeof global === "object") {
  addWellKnownComposite(global, "global");
}
if (typeof window === "object") {
  addWellKnownComposite(window, "window");
}
