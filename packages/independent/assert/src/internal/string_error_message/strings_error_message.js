/*
- Update shorted than expected with the following:

String is too short, 40 characters are missing
--- found ---
145 characters
--- expected ---- 
180 characters
--- details ---
const a = false;
const b = true;
const z = true;
      ^ unexpected end of string here
  7 | const d = true;
  8 | const e = false;


- Update longer than expected:

String is too long, is has 40 extra characters
--- found ---
145 characters
--- expected ---
80 characters
--- details  ----
  4 | const a = false;
  5 | const b = true;
> 6 | const z = true;
    |       ^ string was expected to end here
  7 | const d = true;
  8 | const e = false;
    

*/

import { inspect } from "@jsenv/inspect";

import { frameString } from "./frame_string.js";
import { createLineAndColumnConverter } from "./line_and_column.js";
import { createDetailedMessage } from "../detailed_message.js";
import { comparisonToPath } from "../comparisonToPath.js";
import { isError, isRegExp } from "../object-subtype.js";

export const stringsComparisonToErrorMessage = (comparison) => {
  if (comparison.type !== "identity") {
    return undefined;
  }
  const { actual, expected } = comparison;
  if (typeof actual !== "string") {
    return undefined;
  }
  if (typeof expected !== "string") {
    return undefined;
  }

  const comparisonName = comparisonNameFromComparison(comparison);
  const path = comparisonToPath(comparison);
  const mismatchInfo = getStringMismatchInfo(comparison);

  const enrichPath = (path, index, line, column) => {
    if (line === 0 && column < 100) {
      return `${path}[${index + 1}]`;
    }
    return `${path}[${index + 1}]#L${line + 1}C${column + 1}`;
  };

  if (mismatchInfo.type === "too_short") {
    const { actualLength } = mismatchInfo;
    // const missingCharacterCount = expectedLength - actualLength;
    const index = actualLength - 1;
    const lineAndColumnConverter = createLineAndColumnConverter(expected);
    const { line, column } = lineAndColumnConverter.positionFromIndex(index);
    let message;
    message = `unexpected end of string after character ${inspect(
      actual[index],
    )}`;
    const details = frameString(expected, {
      line,
      column,
      annotation: `^ unexpected end of string`,
    });
    return createDetailedMessage(message, {
      details,
      path: enrichPath(path, index, line, column),
    });
  }
  if (mismatchInfo.type === "too_long") {
    const { actualLength, expectedLength } = mismatchInfo;
    const extraCharacterCount = actualLength - expectedLength;
    let message;
    if (extraCharacterCount === 1) {
      message = `1 extra character in ${comparisonName}`;
    } else {
      message = `${extraCharacterCount} extra characters in ${comparisonName}`;
    }
    return createDetailedMessage(message, {
      path,
    });
  }

  const { index } = mismatchInfo;
  const lineAndColumnConverter = createLineAndColumnConverter(actual);
  const { line, column } = lineAndColumnConverter.positionFromIndex(index);
  let message = `unexpected character, ${inspect(
    actual[index],
  )} was found instead of ${inspect(expected[index])}`;
  if (/\r?\n/.test(expected)) {
    // get line and column
    message += ` (line ${line} column ${column})`;
  }
  const details = frameString(actual, {
    line,
    column,
    annotation: `^ unexpected character`,
  });
  return createDetailedMessage(message, {
    details,
    path: enrichPath(path, index, line, column),
  });
};

const getStringMismatchInfo = ({ actual, expected }) => {
  // for arrays we compare the length first and print the extra/missing values in the actual array
  // for strings we'll operate differently, we start by extracting
  // a string with the right length from actual
  // and compare each characters
  // to detect the first unexpected character
  // if there is none, we will tell if the string is
  // longer/shorter than expected and by how much
  const actualLength = actual.length;
  const expectedLength = expected.length;

  let i = 0;
  while (i < actualLength && i < expectedLength) {
    const actualChar = actual[i];
    const expectedChar = expected[i];
    if (actualChar !== expectedChar) {
      return {
        type: "unequal",
        index: i,
        actualChar,
        expectedChar,
      };
    }
    i++;
  }

  if (actualLength < expectedLength) {
    return {
      type: "too_short",
      actualLength,
      expectedLength,
    };
  }

  return {
    type: "too_long",
    actualLength,
    expectedLength,
  };
};

const comparisonNameFromComparison = (comparison) => {
  if (detectRegExpToStringComparison(comparison)) {
    return `regexp`;
  }
  if (detectErrorMessageComparison(comparison)) {
    return `error message`;
  }
  if (detectFunctionNameComparison(comparison)) {
    return `function name`;
  }
  return `string`;
};
const detectRegExpToStringComparison = (comparison) => {
  const parentComparison = comparison.parent;
  if (parentComparison.type !== "to-string-return-value") {
    return false;
  }

  const grandParentComparison = parentComparison.parent;
  if (
    !isRegExp(grandParentComparison.actual) ||
    !isRegExp(grandParentComparison.expected)
  ) {
    return false;
  }

  return true;
};
const detectErrorMessageComparison = (comparison) => {
  const parentComparison = comparison.parent;
  if (parentComparison.type !== "property-value") {
    return false;
  }
  if (parentComparison.data !== "message") {
    return false;
  }

  const grandParentComparison = parentComparison.parent;
  if (
    !isError(grandParentComparison.actual) ||
    !isError(grandParentComparison.expected)
  ) {
    return false;
  }

  return true;
};
const detectFunctionNameComparison = (comparison) => {
  const parentComparison = comparison.parent;
  if (parentComparison.type !== "property-value") {
    return false;
  }
  if (parentComparison.data !== "name") {
    return false;
  }

  const grandParentComparison = parentComparison.parent;
  if (
    typeof grandParentComparison.actual !== "function" ||
    typeof grandParentComparison.expected !== "function"
  ) {
    return false;
  }

  return true;
};
