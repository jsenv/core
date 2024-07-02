// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
import { createValuePath } from "./value_path.js";
import { isComposite } from "./is_composite.js";

const wellKnownWeakMap = new WeakMap();
const numberWellKnownMap = new Map();
const symbolWellKnownMap = new Map();
export const getWellKnownValuePath = (value) => {
  if (!wellKnownWeakMap.size) {
    visitValue(global, createValuePath());
    visitValue(
      AsyncFunction,
      createValuePath([
        {
          type: "identifier",
          value: "AsyncFunction",
        },
      ]),
    );
    visitValue(
      GeneratorFunction,
      createValuePath([
        {
          type: "identifier",
          value: "GeneratorFunction",
        },
      ]),
    );
    visitValue(
      AsyncGeneratorFunction,
      createValuePath([
        { type: "identifier", value: "AsyncGeneratorFunction" },
      ]),
    );
    for (const numberOwnPropertyName of Object.getOwnPropertyNames(Number)) {
      if (
        numberOwnPropertyName === "MAX_VALUE" ||
        numberOwnPropertyName === "MIN_VALUE" ||
        numberOwnPropertyName === "MAX_SAFE_INTEGER" ||
        numberOwnPropertyName === "MIN_SAFE_INTEGER" ||
        numberOwnPropertyName === "EPSILON"
      ) {
        numberWellKnownMap.set(Number[numberOwnPropertyName], [
          { type: "identifier", value: "Number" },
          { type: "property_dot", value: "." },
          { type: "property_identifier", value: numberOwnPropertyName },
        ]);
      }
    }
    for (const mathOwnPropertyName of Object.getOwnPropertyNames(Math)) {
      if (
        mathOwnPropertyName === "E" ||
        mathOwnPropertyName === "LN2" ||
        mathOwnPropertyName === "LN10" ||
        mathOwnPropertyName === "LOG2E" ||
        mathOwnPropertyName === "LOG10E" ||
        mathOwnPropertyName === "PI" ||
        mathOwnPropertyName === "SQRT1_2" ||
        mathOwnPropertyName === "SQRT2"
      ) {
        numberWellKnownMap.set(Math[mathOwnPropertyName], [
          { type: "identifier", value: "Math" },
          { type: "property_dot", value: "." },
          { type: "property_identifier", value: mathOwnPropertyName },
        ]);
      }
    }
  }
  if (typeof value === "symbol") {
    return symbolWellKnownMap.get(value);
  }
  if (typeof value === "number") {
    return numberWellKnownMap.get(value);
  }
  return wellKnownWeakMap.get(value);
};

const AsyncFunction = async function () {}.constructor;
const GeneratorFunction = function* () {}.constructor;
const AsyncGeneratorFunction = async function* () {}.constructor;

const visitValue = (value, valuePath) => {
  if (typeof value === "symbol") {
    symbolWellKnownMap.set(value, valuePath);
    return;
  }
  if (!isComposite(value)) {
    return;
  }

  if (wellKnownWeakMap.has(value)) {
    // prevent infinite recursion on circular structures
    return;
  }
  wellKnownWeakMap.set(value, valuePath);

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
      visitValue(propertyValue, valuePath.append(property));
    }
  };
  for (const property of Object.getOwnPropertyNames(value)) {
    visitProperty(property);
  }
  for (const symbol of Object.getOwnPropertySymbols(value)) {
    visitProperty(symbol);
  }
  if (isComposite(value)) {
    const protoValue = Object.getPrototypeOf(value);
    if (protoValue && !wellKnownWeakMap.has(protoValue)) {
      visitValue(protoValue, valuePath.append("__proto__"));
    }
  }
};
