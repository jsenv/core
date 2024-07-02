import { assert } from "../../src/assert_scratch.js";

const ensureTypeErrorWithMessage = (value, message) => {
  if (value.name !== "TypeError") {
    throw new Error(`error expected, got ${value}`);
  }
  if (value.message !== message) {
    throw new Error(`unequal error message.
--- message ---
${value.message}
--- expected message ---
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
  // but people might think assert() signature is (actual, expected)
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
