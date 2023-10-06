import { inspect, determineQuote, inspectChar } from "@jsenv/inspect";

import { createDetailedMessage } from "../detailed_message.js";
import { comparisonToPath } from "../comparison_to_path.js";
import { isRegExp, isError } from "../object_subtype.js";

const MAX_CHARS_AROUND_MISMATCH = 200;
const EXPECTED_CONTINUES_WITH_MAX_LENGTH = 15;

export const stringsComparisonToErrorMessage = (comparison) => {
  const isStartsWithComparison = comparison.type === "starts_with";

  if (comparison.type !== "identity" && !isStartsWithComparison) {
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

  const stringName = stringNameFromComparison(comparison);
  const actualLength = actual.length;
  const expectedLength = expected.length;
  let i = 0;
  let lineIndex = 0;
  let columnIndex = 0;

  const formatDetails = ({
    charsToDisplayBefore,
    charsToDisplayAfter = MAX_CHARS_AROUND_MISMATCH - charsToDisplayBefore,
    annotationLabel,
    expectedOverview = true,
  }) => {
    let details = "";
    let indexStart = i - charsToDisplayBefore;
    if (indexStart < 0) {
      indexStart = 0;
    }
    let index = indexStart;
    write_chars_before_point_on_failure: {
      // put some chars before the first mismatch
      if (indexStart > 0) {
        details += "…"; // tell that some chars are skipped
      }
      details += `${actualQuote}`;
      while (charsToDisplayBefore-- && index < i) {
        const actualChar = actual[index];
        index++;
        if (index > i) {
          break;
        }
        details += formatActualChar(actualChar);
      }
    }
    write_chars_after_point_on_failure: {
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
    }
    write_annotation: {
      let annotationColumn = columnIndex;
      // put annotation
      if (lineIndex === 0) {
        if (indexStart > 0) {
          annotationColumn++; // ... injection at the beginning
        }
        annotationColumn++; // " injection at the begining
      }
      const annotationIndentation = " ".repeat(annotationColumn);
      details += `\n${annotationIndentation}`;
      details += `${annotationLabel}`;
      if (expectedOverview) {
        details += ` ${expectedQuote}`;
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
      }
    }
    return details;
  };

  mismatch: {
    while (i < actualLength && i < expectedLength) {
      const actualChar = actual[i];
      const expectedChar = expected[i];
      if (actualChar !== expectedChar) {
        const message = `unexpected ${stringName}, ${inspect(
          actualChar,
        )} was found instead of ${inspect(expectedChar)} at index ${i}`;
        return createDetailedMessage(message, {
          details: formatDetails({
            charsToDisplayBefore: Math.floor(MAX_CHARS_AROUND_MISMATCH / 2),
            annotationLabel: `^ unexpected character, expected string continues with`,
          }),
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
  }
  too_short: {
    if (actualLength < expectedLength) {
      const missingCharacterCount = expectedLength - actualLength;
      let message = `${stringName} is too short`;
      if (missingCharacterCount === 1) {
        message += `, one character is missing`;
      } else {
        message += `, ${missingCharacterCount} characters are missing`;
      }
      return createDetailedMessage(message, {
        details: formatDetails({
          charsToDisplayBefore: MAX_CHARS_AROUND_MISMATCH,
          charsToDisplayAfter: 0,
          annotationLabel: `^ expected string continues with`,
        }),
        path,
      });
    }
  }
  too_long: {
    i = expectedLength;
    const extraCharacterCount = actualLength - expectedLength;
    let message = `${stringName} is too long`;
    if (extraCharacterCount === 1) {
      message += `, it contains one extra character`;
    } else {
      message += `, it contains ${extraCharacterCount} extra characters`;
    }
    // const continuesWithLineBreak = isLineBreak(actual[expectedLength]);
    return createDetailedMessage(message, {
      details: formatDetails({
        charsToDisplayBefore: Math.floor(MAX_CHARS_AROUND_MISMATCH / 2),
        annotationLabel:
          expectedLength === 0
            ? `^ an empty string was expected`
            : `^ string was expected to end here`,
        expectedOverview: false,
      }),
      path,
    });
  }
};

const isLineBreak = (char) => {
  return char === "\n" || char === "\r";
};

const stringNameFromComparison = (comparison) => {
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
