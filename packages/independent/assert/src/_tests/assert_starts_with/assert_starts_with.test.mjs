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
      `unexpected string, "A" was found instead of "B" at index 1
--- details ---
"AABB"
  ^ unexpected character, expected string continues with "B"
--- path ---
actual[1]`,
    );
  }
}
