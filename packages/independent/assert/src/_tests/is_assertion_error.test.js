import { assert } from "@jsenv/assert";

{
  const assertionErrorCandidate = false;
  if (assert.isAssertionError(assertionErrorCandidate)) {
    throw new Error(
      `isAssertionError should return false for ${assertionErrorCandidate}`,
    );
  }
}

{
  const assertionErrorCandidate = true;
  if (assert.isAssertionError(assertionErrorCandidate)) {
    throw new Error(
      `isAssertionError should return false for ${assertionErrorCandidate}`,
    );
  }
}

{
  const assertionErrorCandidate = {
    name: "AssertionError",
  };
  if (!assert.isAssertionError(assertionErrorCandidate)) {
    throw new Error(
      `isAssertionError should return true for ${assertionErrorCandidate}`,
    );
  }
}

{
  const assertionErrorCandidate = assert.createAssertionError();
  if (!assert.isAssertionError(assertionErrorCandidate)) {
    throw new Error(
      `isAssertionError should return true for ${assertionErrorCandidate}`,
    );
  }
}
