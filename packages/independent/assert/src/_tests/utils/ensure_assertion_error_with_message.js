import { assert } from "@jsenv/assert";
import stripAnsi from "strip-ansi";

export const ensureAssertionErrorWithMessage = (value, expectedMessage) => {
  if (!assert.isAssertionError(value)) {
    throw new Error(`assertionError expected, got ${value.stack}`);
  }
  const actualMessage = stripAnsi(value.message);
  if (actualMessage !== expectedMessage) {
    throw new Error(`unequal assertion error messages
___________________ MESSAGE FOUND ___________________
${actualMessage}
___________________ MESSAGE EXPECTED ___________________
${expectedMessage}`);
  }
};
