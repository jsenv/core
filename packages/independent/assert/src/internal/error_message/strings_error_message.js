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

import { createDetailedMessage } from "../detailed_message.js";
import { comparisonToPath } from "../comparisonToPath.js";

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

  const actualLength = actual.length;
  const expectedLength = expected.length;
  const actualLineStrings = actual.split(/\r?\n/);
  let i = 0;
  let lineIndex = 0;
  let columnIndex = 0;
  while (i < actualLength && i < expectedLength) {
    const actualChar = actual[i];
    const expectedChar = expected[i];
    if (actualChar !== expectedChar) {
      let message = `string mismatch, ${inspect(
        actualChar,
      )} was found instead of ${inspect(expectedChar)}`;
      const actualLineSource = inspect(actualLineStrings[lineIndex]);
      const annotationColumn = columnIndex + 1; // +1 because quote injection
      const annotationIndentation = ` `.repeat(annotationColumn);
      const annotation = `${annotationIndentation}^ unexpected character`;
      const details = `${actualLineSource}\n${annotation}`;
      return createDetailedMessage(message, {
        details,
        path: enrichPath(path, i, lineIndex, columnIndex),
      });
    }
    if (actualChar === "\n" || actualChar === "\r") {
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
    const expectedLines = expected.split(/\r?\n/);
    const actualLastLineIndex = actualLineStrings.length - 1;
    const expectedLine = expectedLines[actualLastLineIndex];
    const actualLastLine = actualLineStrings[actualLastLineIndex];
    const actualLastLineLength = Buffer.byteLength(actualLastLine);
    const actualLineSource = inspect(actualLastLine);
    const annotationColumn = actualLastLineLength + 1; // +1 because quote injection
    const annotationIndentation = ` `.repeat(annotationColumn);
    let annotation = `${annotationIndentation}^ expected string continues with`;
    annotation += ` ${inspect(
      expectedLine.slice(actualLastLineLength, actualLastLineLength + 3),
    )}`;
    if (missingCharacterCount > 3) {
      annotation += `...`;
    }
    const details = `${actualLineSource}\n${annotation}`;
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
