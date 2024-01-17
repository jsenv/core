import { assert } from "@jsenv/assert";
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js";

{
  const actual = "AABB";
  const expected = assert.startsWith("AAB");
  assert({ actual, expected });
}

{
  const actual = "AABB";
  const expected = assert.startsWith("AB");
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected character in string
--- details ---
AABB
 ^
unexpected "A", expected to continue with "B"
--- path ---
actual`,
    );
  }
}
