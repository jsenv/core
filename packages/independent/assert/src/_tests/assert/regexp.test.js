import { assert } from "@jsenv/assert";
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js";
import { executeInNewContext } from "../executeInNewContext.js";

{
  const actual = /a/;
  const expected = /a/;
  assert({ actual, expected });
}

{
  const actual = await executeInNewContext("/a/");
  const expected = /a/;
  assert({ actual, expected });
}

{
  const actual = /a/;
  const expected = /b/;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected regexp, "a" was found instead of "b" at index 1
--- details ---
"/a/"
  ^ unexpected character, expected string continues with "b/"
--- path ---
actual.toString()[1]`,
    );
  }
}

{
  const actual = await executeInNewContext("/a/");
  const expected = /b/;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected regexp, "a" was found instead of "b" at index 1
--- details ---
"/a/"
  ^ unexpected character, expected string continues with "b/"
--- path ---
actual.toString()[1]`,
    );
  }
}
