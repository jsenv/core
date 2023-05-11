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
      `unequal regexps
--- found ---
"/a/"
--- expected ---
"/b/"
--- path ---
actual.toString()
--- details ---
unexpected character at index 1, "a" was found instead of "b"`,
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
      `unequal regexps
--- found ---
"/a/"
--- expected ---
"/b/"
--- path ---
actual.toString()
--- details ---
unexpected character at index 1, "a" was found instead of "b"`,
    );
  }
}
