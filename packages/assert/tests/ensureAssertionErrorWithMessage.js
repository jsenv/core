import { isAssertionError } from "@jsenv/assert"

export const ensureAssertionErrorWithMessage = (value, message) => {
  if (!isAssertionError(value)) {
    throw new Error(`assertionError expected, got ${value.stack}`)
  }
  if (value.message !== message) {
    throw new Error(`unequal assertion error messages
___________________ MESSAGE FOUND ___________________
${value.message}
___________________ MESSAGE EXPECTED ___________________
${message}`)
  }
}
