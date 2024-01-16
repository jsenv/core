// primitives
import { inspectBoolean } from "./boolean.js";
import { inspectNull } from "./null.js";
import { inspectNumber } from "./number.js";
import { inspectString } from "./string.js";
import { inspectSymbol } from "./symbol.js";
import { inspectUndefined } from "./undefined.js";
import { inspectBigInt } from "./bigint.js";
import { inspectArray } from "./array.js";
// composites
import { inspectBigIntObject } from "./bigint_object.js";
import { inspectBooleanObject } from "./boolean_object.js";
import { inspectError } from "./error.js";
import { inspectDate } from "./date.js";
import { inspectFunction } from "./function.js";
import { inspectNumberObject } from "./number_object.js";
import { inspectObject } from "./object.js";
import { inspectRegExp } from "./regexp.js";
import { inspectStringObject } from "./string_object.js";
import { inspectConstructor } from "./constructor.js";

export const inspectMethodSymbol = Symbol.for("inspect");

export const inspectValue = (value, options) => {
  const customInspect = value && value[inspectMethodSymbol];
  if (customInspect) {
    return customInspect(options);
  }
  const primitiveType = primitiveTypeFromValue(value);
  const primitiveStringifier = primitiveStringifiers[primitiveType];
  if (primitiveStringifier) {
    return primitiveStringifier(value, options);
  }
  const compositeType = compositeTypeFromObject(value);
  const compositeStringifier = compositeStringifiers[compositeType];
  if (compositeStringifier) {
    return compositeStringifier(value, options);
  }
  return inspectConstructor(
    `${compositeType}(${inspectObject(value, options)})`,
    {
      ...options,
      parenthesis: false,
    },
  );
};

const primitiveTypeFromValue = (value) => {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  return typeof value;
};
const primitiveStringifiers = {
  boolean: inspectBoolean,
  function: inspectFunction,
  null: inspectNull,
  number: inspectNumber,
  string: inspectString,
  symbol: inspectSymbol,
  undefined: inspectUndefined,
  bigint: inspectBigInt,
};
const compositeTypeFromObject = (object) => {
  if (typeof object === "object" && Object.getPrototypeOf(object) === null) {
    return "Object";
  }
  const toStringResult = toString.call(object);
  // returns format is '[object ${tagName}]';
  // and we want ${tagName}
  const tagName = toStringResult.slice("[object ".length, -1);
  if (tagName === "Object") {
    const objectConstructorName = object.constructor.name;
    if (objectConstructorName !== "Object") {
      return objectConstructorName;
    }
  }
  return tagName;
};
const { toString } = Object.prototype;

const compositeStringifiers = {
  Array: inspectArray,
  BigInt: inspectBigIntObject,
  Boolean: inspectBooleanObject,
  Error: inspectError,
  Date: inspectDate,
  Function: inspectFunction,
  Number: inspectNumberObject,
  Object: inspectObject,
  RegExp: inspectRegExp,
  String: inspectStringObject,
};
