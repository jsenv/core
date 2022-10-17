import { isAssertionError, createAssertionError } from "@jsenv/assert"

{
  const assertionErrorCandidate = false
  if (isAssertionError(assertionErrorCandidate)) {
    throw new Error(
      `isAssertionError should return false for ${assertionErrorCandidate}`,
    )
  }
}

{
  const assertionErrorCandidate = true
  if (isAssertionError(assertionErrorCandidate)) {
    throw new Error(
      `isAssertionError should return false for ${assertionErrorCandidate}`,
    )
  }
}

{
  const assertionErrorCandidate = {
    name: "AssertionError",
  }
  if (!isAssertionError(assertionErrorCandidate)) {
    throw new Error(
      `isAssertionError should return true for ${assertionErrorCandidate}`,
    )
  }
}

{
  const assertionErrorCandidate = createAssertionError()
  if (!isAssertionError(assertionErrorCandidate)) {
    throw new Error(
      `isAssertionError should return true for ${assertionErrorCandidate}`,
    )
  }
}
