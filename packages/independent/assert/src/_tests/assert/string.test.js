import { assert } from "@jsenv/assert";
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js";

// mismatch
{
  const actual = `	 `;
  const expected = `  `;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `string mismatch, "\\t" was found instead of " "
--- details ---
"\\t "
 ^ unexpected character
--- path ---
actual[0]`,
    );
  }
}

// too long
{
  const actual = String.fromCharCode(127);
  const expected = "";
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `string is too long, it contains one extra character
--- details ---
"\\x7F"
 ^ an empty string was expected
--- path ---
actual`,
    );
  }
}
{
  const actual = `aa`;
  const expected = ``;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `string is too long, it contains 2 extra characters
--- details ---
"aa"
 ^ an empty string was expected
--- path ---
actual`,
    );
  }
}

// too short
{
  const actual = `a`;
  const expected = `ab`;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `string is too short, one character is missing
--- details ---
"a"
  ^ expected string continues with "b"
--- path ---
actual`,
    );
  }
}
{
  const actual = ``;
  const expected = `aa`;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `string is too short, 2 characters are missing
--- details ---
""
 ^ expected string continues with "aa"
--- path ---
actual`,
    );
  }
}
{
  const actual = `Hello,
I am ben`;
  const expected = `Hello,
I am benjamin`;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `string is too short, 5 characters are missing
--- details ---
"I am ben"
         ^ expected string continues with "jam"...
--- path ---
actual`,
    );
  }
}
