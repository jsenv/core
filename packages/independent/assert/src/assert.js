import {
  compare,
  createNotExpectation,
  createAnyExpectation,
  createStartsWithExpectation,
  createMatchesRegExpExpectation,
  createCloseToExpectation,
  createBetweenExpectation,
} from "./internal/compare.js";
import { errorMessageFromComparison } from "./internal/error_message_from_comparison.js";
import { createAssertionError } from "./assertion_error.js";

export const assert = (...args) => {
  if (args.length === 0) {
    throw new Error(
      `assert must be called with { actual, expected }, missing first argument`,
    );
  }
  if (args.length > 1) {
    throw new Error(
      `assert must be called with { actual, expected }, received too many arguments`,
    );
  }
  const firstArg = args[0];
  if (typeof firstArg !== "object" || firstArg === null) {
    throw new Error(
      `assert must be called with { actual, expected }, received ${firstArg} as first argument instead of object`,
    );
  }
  if ("actual" in firstArg === false) {
    throw new Error(
      `assert must be called with { actual, expected }, missing actual property on first argument`,
    );
  }
  if ("expected" in firstArg === false) {
    throw new Error(
      `assert must be called with { actual, expected }, missing expected property on first argument`,
    );
  }
  const {
    actual,
    expected,
    message,
    // An other good alternative to "checkPropertiesOrder" could be
    // to have an helper like sortingProperties
    // const value = assert.sortProperties(value)
    // const expected = assert.sortProperties({ foo: true, bar: true })
    checkPropertiesOrder = true,
    details,
  } = firstArg;
  const expectation = {
    actual,
    expected,
  };
  const comparison = compare(expectation, { checkPropertiesOrder });
  if (comparison.failed) {
    let errorMessage = message || errorMessageFromComparison(comparison);
    errorMessage = appendDetails(errorMessage, details);
    const error = createAssertionError(errorMessage);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(error, assert);
    }
    throw error;
  }
};

const appendDetails = (message, details = {}) => {
  let string = `${message}`;

  Object.keys(details).forEach((key) => {
    const value = details[key];
    string += `
--- ${key} ---
${
  Array.isArray(value)
    ? value.join(`
`)
    : value
}`;
  });
  return string;
};

assert.not = (value) => {
  return createNotExpectation(value);
};
assert.any = (Constructor) => {
  return createAnyExpectation(Constructor);
};
assert.matchesRegExp = (regexp) => {
  const isRegExp = regexp instanceof RegExp;
  if (!isRegExp) {
    throw new TypeError(
      `assert.matchesRegExp must be called with a regexp, received ${regexp}`,
    );
  }
  return createMatchesRegExpExpectation(regexp);
};
assert.startsWith = (string) => {
  return createStartsWithExpectation(string);
};
assert.closeTo = (value) => {
  if (typeof value !== "number") {
    throw new TypeError(
      `assert.closeTo must be called with a number, received ${value}`,
    );
  }
  return createCloseToExpectation(value);
};
assert.between = (minValue, maxValue) => {
  if (typeof minValue !== "number") {
    throw new TypeError(
      `assert.around 1st argument must be number, received ${minValue}`,
    );
  }
  if (typeof maxValue !== "number") {
    throw new TypeError(
      `assert.around 2nd argument must be number, received ${maxValue}`,
    );
  }
  if (minValue > maxValue) {
    throw new Error(
      `assert.around 1st argument is > 2nd argument, ${minValue} > ${maxValue}`,
    );
  }
  return createBetweenExpectation(minValue, maxValue);
};

assert.asObjectWithoutPrototype = (object) => {
  const objectWithoutPrototype = Object.create(null);
  Object.assign(objectWithoutPrototype, object);
  return objectWithoutPrototype;
};
