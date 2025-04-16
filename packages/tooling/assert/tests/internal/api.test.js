import { assert } from "@jsenv/assert";

const ensureTypeErrorWithMessage = (value, message) => {
  if (value.name !== "TypeError") {
    throw new Error(`error expect,got ${value}`);
  }
  if (value.message !== message) {
    throw new Error(`unequal error message.
--- message ---
${value.message}
--- expect message ---
${message}`);
  }
};

try {
  assert();
  throw new Error("should throw");
} catch (e) {
  ensureTypeErrorWithMessage(
    e,
    `assert must be called with { actual, expect }, it was called without any argument`,
  );
}

try {
  assert(true, false);
  throw new Error("should throw");
} catch (e) {
  ensureTypeErrorWithMessage(
    e,
    `assert must be called with { actual, expect }, it was called with too many arguments`,
  );
}

try {
  // we could consider this call as valid
  // but people might think assert() signature is (actual, expect)
  // we have to throw in that case too to informe they are
  // doing something unexpected
  assert({ actual: true, expect: true }, false);
  throw new Error("should throw");
} catch (e) {
  ensureTypeErrorWithMessage(
    e,
    `assert must be called with { actual, expect }, it was called with too many arguments`,
  );
}

try {
  assert(null);
  throw new Error("should throw");
} catch (e) {
  ensureTypeErrorWithMessage(
    e,
    `assert must be called with { actual, expect }, received null as first argument instead of object`,
  );
}

try {
  assert({ expect: undefined });
  throw new Error("should throw");
} catch (e) {
  ensureTypeErrorWithMessage(
    e,
    `assert must be called with { actual, expect }, actual is missing`,
  );
}

try {
  assert({ actual: undefined });
  throw new Error("should throw");
} catch (e) {
  ensureTypeErrorWithMessage(
    e,
    `assert must be called with { actual, expect }, expect is missing`,
  );
}

const testAssertionErrorResult = ({ shouldPass, shouldFail }) => {
  for (const value of shouldPass) {
    const result = assert.isAssertionError(value);
    if (!result) {
      throw new Error(`isAssertionError should return true for ${value}`);
    }
  }
  for (const value of shouldFail) {
    const result = assert.isAssertionError(value);
    if (result) {
      throw new Error(`isAssertionError should return false for ${value}`);
    }
  }
};

testAssertionErrorResult({
  shouldPass: [
    assert.createAssertionError(),
    { constructor: { name: "AssertionError" } },
  ],
  shouldFail: [false, true, new Error(), { name: "AssertionError" }],
});
