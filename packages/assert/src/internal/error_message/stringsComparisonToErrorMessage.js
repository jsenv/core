import { createDetailedMessage } from "../detailed_message.js";
import { comparisonToPath } from "../comparisonToPath.js";
import { valueToString } from "../valueToString.js";
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

  const description = descriptionFromComparison(comparison);
  const foundAsString = valueToString(actual);
  const expectedAsString = valueToString(expected);
  const path = comparisonToPath(comparison);
  const details = detailsFromComparison(comparison);

  return createDetailedMessage(description, {
    found: foundAsString,
    expected: expectedAsString,
    path,
    details,
  });
};

const descriptionFromComparison = (comparison) => {
  if (detectRegExpToStringComparison(comparison)) {
    return `unequal regexps`;
  }
  if (detectErrorMessageComparison(comparison)) {
    return `unequal error messages`;
  }
  if (detectFunctionNameComparison(comparison)) {
    return `unequal function names`;
  }
  return `unequal strings`;
};

const detailsFromComparison = (comparison) => {
  const mismatchInfo = getStringMismatchInfo(comparison);

  if (mismatchInfo.type === "unexpectedCharacter") {
    const { index, expectedChar, actualChar } = mismatchInfo;
    return `unexpected character at index ${index}, ${valueToString(
      actualChar,
    )} was found instead of ${valueToString(expectedChar)}`;
  }

  if (mismatchInfo.type === "shorterThanExpected") {
    const { actualLength, expectedLength } = mismatchInfo;
    const missingCharacterCount = expectedLength - actualLength;
    if (missingCharacterCount === 1) {
      return `string found is too short, 1 character is missing`;
    }
    return `string found is too short, ${missingCharacterCount} characters are missing`;
  }

  const { actualLength, expectedLength } = mismatchInfo;
  const extraCharacterCount = actualLength - expectedLength;
  if (extraCharacterCount === 1) {
    return `string found is too long, it has 1 extra character`;
  }
  return `string found is too long, it has ${extraCharacterCount} extra characters`;
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
        type: "unexpectedCharacter",
        index: i,
        actualChar,
        expectedChar,
      };
    }
    i++;
  }

  if (actualLength < expectedLength) {
    return {
      type: "shorterThanExpected",
      actualLength,
      expectedLength,
    };
  }

  return {
    type: "longerThanExpected",
    actualLength,
    expectedLength,
  };
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
