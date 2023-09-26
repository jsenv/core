import { inspect, determineQuote, inspectChar } from "@jsenv/inspect";

import { createDetailedMessage } from "../detailed_message.js";
import { comparisonToPath } from "../comparison_to_path.js";

const MAX_CHARS_AROUND_MISMATCH = 200;
const ACTUAL_MAX_LENGTH = 50;
const EXPECTED_CONTINUES_WITH_MAX_LENGTH = 15;

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

  const path = comparisonToPath(comparison);
  const enrichPath = (path, index, line, column) => {
    if (line === 0 && column < 100) {
      return `${path}[${index}]`;
    }
    return `${path}[${index}]#L${line + 1}C${column + 1}`;
  };
  const actualQuote = determineQuote(actual);
  const formatActualChar = (char) => {
    return inspectChar(char, { quote: actualQuote, preserveLineBreaks: true });
  };
  const expectedQuote = determineQuote(expected);
  const formatExpectedChar = (char) => {
    return inspectChar(char, {
      quote: expectedQuote,
      preserveLineBreaks: false,
    });
  };

  const actualLength = actual.length;
  const expectedLength = expected.length;
  const actualLineStrings = actual.split(/\r?\n/);
  let i = 0;
  let lineIndex = 0;
  let columnIndex = 0;
  while (i < actualLength && i < expectedLength) {
    const actualChar = actual[i];
    const expectedChar = expected[i];
    // mismatch
    if (actualChar !== expectedChar) {
      let message = `string mismatch, ${inspect(
        actualChar,
      )} was found instead of ${inspect(expectedChar)}`;

      let details = "";
      let annotationColumn = columnIndex;
      let charsToDisplayBefore = Math.floor(MAX_CHARS_AROUND_MISMATCH / 2);
      let charsToDisplayAfter =
        MAX_CHARS_AROUND_MISMATCH - charsToDisplayBefore;

      let indexStart = i - charsToDisplayBefore;
      if (indexStart < 0) {
        indexStart = 0;
      }
      // put some chars before the first mismatch
      if (indexStart > 0) {
        details += "…"; // tell that some chars are skipped
      }
      details += `${actualQuote}`;
      let index = indexStart;
      while (charsToDisplayBefore-- && index < i) {
        const actualChar = actual[index];
        index++;
        if (index > i) {
          break;
        }
        details += formatActualChar(actualChar);
      }
      // now put chars until end of line or end of chars to display
      while (charsToDisplayAfter-- && index < actualLength) {
        const actualChar = actual[index];
        if (isLineBreak(actualChar)) {
          break;
        }
        index++;
        details += formatActualChar(actualChar);
      }
      details += `${actualQuote}`;
      if (index < actualLength) {
        details += "…";
      }
      // put annotation
      if (lineIndex === 0) {
        if (indexStart > 0) {
          annotationColumn++; // ... injection at the beginning
        }
        annotationColumn++; // " injection at the begining
      }
      const annotationIndentation = " ".repeat(annotationColumn);
      details += `\n${annotationIndentation}`;
      details += `^ unexpected character, expected string continues with ${expectedQuote}`;
      // put expected chars
      let expectedIndex = i;
      let remainingCharsToDisplayOnExpected =
        EXPECTED_CONTINUES_WITH_MAX_LENGTH;
      while (
        remainingCharsToDisplayOnExpected-- &&
        expectedIndex < expectedLength
      ) {
        const expectedChar = expected[expectedIndex];
        if (expectedIndex > i && isLineBreak(expectedChar)) {
          break;
        }
        expectedIndex++;
        details += formatExpectedChar(expectedChar);
      }
      details += `${expectedQuote}`;
      if (expectedIndex < expectedLength) {
        details += "…";
      }
      return createDetailedMessage(message, {
        details,
        path: enrichPath(path, i, lineIndex, columnIndex),
      });
    }
    if (isLineBreak(actualChar)) {
      lineIndex++;
      columnIndex = 0;
    } else {
      columnIndex++;
    }
    i++;
  }
  // too short
  if (actualLength < expectedLength) {
    const missingCharacterCount = expectedLength - actualLength;
    let message = `string is too short`;
    if (missingCharacterCount === 1) {
      message += `, one character is missing`;
    } else {
      message += `, ${missingCharacterCount} characters are missing`;
    }
    const actualTruncated = actual.slice(0, ACTUAL_MAX_LENGTH);
    const actualFormatted = formatString(actualTruncated);
    const annotationColumn = lineIndex === 0 ? columnIndex + 1 : columnIndex; // +1 because quote injection by formatString
    const annotationIndentation = ` `.repeat(annotationColumn);
    const annotation = `${annotationIndentation}^ ${formatMismatchAt(
      expected,
      actualLength,
    )}`;
    const details = `${actualFormatted}\n${annotation}`;
    return createDetailedMessage(message, {
      details,
      path,
    });
  }
  // too long
  i = expectedLength;
  const extraCharacterCount = actualLength - expectedLength;
  let message = `string is too long`;
  if (extraCharacterCount === 1) {
    message += `, it contains one extra character`;
  } else {
    message += `, it contains ${extraCharacterCount} extra characters`;
  }
  const actualLineSource = inspect(
    actualLineStrings[actualLineStrings.length - 1],
  );
  const annotationIndentation = ` `.repeat(expectedLength + 1); // +1 because quote injection in lineSource
  let annotation;
  if (expectedLength === 0) {
    annotation = `${annotationIndentation}^ an empty string was expected`;
  } else {
    annotation = `${annotationIndentation}^ string was expected to end here`;
  }
  const details = `${actualLineSource}\n${annotation}`;
  return createDetailedMessage(message, {
    details,
    path,
  });
};

const isLineBreak = (char) => {
  return char === "\n" || char === "\r";
};

const formatString = (string) => {
  return inspect(string, { preserveLineBreaks: true });
};

const formatMismatchAt = (expected, index) => {
  const remainingChars = expected.length - index;
  const maxIndex = index + EXPECTED_CONTINUES_WITH_MAX_LENGTH;
  const expectedOverview = expected.slice(index, maxIndex);
  const overviewFormatted = formatString(expectedOverview);
  if (remainingChars > EXPECTED_CONTINUES_WITH_MAX_LENGTH) {
    if (index === 0) {
      return `expected string starts with ${overviewFormatted}`;
    }
    return `expected string continues with ${overviewFormatted}`;
  }
  return `expected string continues with ${overviewFormatted}`;
};

// const comparisonNameFromComparison = (comparison) => {
//   if (detectRegExpToStringComparison(comparison)) {
//     return `regexp`;
//   }
//   if (detectErrorMessageComparison(comparison)) {
//     return `error message`;
//   }
//   if (detectFunctionNameComparison(comparison)) {
//     return `function name`;
//   }
//   return `string`;
// };
// const detectRegExpToStringComparison = (comparison) => {
//   const parentComparison = comparison.parent;
//   if (parentComparison.type !== "to-string-return-value") {
//     return false;
//   }

//   const grandParentComparison = parentComparison.parent;
//   if (
//     !isRegExp(grandParentComparison.actual) ||
//     !isRegExp(grandParentComparison.expected)
//   ) {
//     return false;
//   }

//   return true;
// };
// const detectErrorMessageComparison = (comparison) => {
//   const parentComparison = comparison.parent;
//   if (parentComparison.type !== "property-value") {
//     return false;
//   }
//   if (parentComparison.data !== "message") {
//     return false;
//   }

//   const grandParentComparison = parentComparison.parent;
//   if (
//     !isError(grandParentComparison.actual) ||
//     !isError(grandParentComparison.expected)
//   ) {
//     return false;
//   }

//   return true;
// };
// const detectFunctionNameComparison = (comparison) => {
//   const parentComparison = comparison.parent;
//   if (parentComparison.type !== "property-value") {
//     return false;
//   }
//   if (parentComparison.data !== "name") {
//     return false;
//   }

//   const grandParentComparison = parentComparison.parent;
//   if (
//     typeof grandParentComparison.actual !== "function" ||
//     typeof grandParentComparison.expected !== "function"
//   ) {
//     return false;
//   }

//   return true;
// };
