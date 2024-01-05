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
      `unexpected character in regexp
--- details ---
/a/
 ^
unexpected "a", expected to continue with "b/"
--- path ---
actual.toString()`,
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
      `unexpected character in regexp
--- details ---
/a/
 ^
unexpected "a", expected to continue with "b/"
--- path ---
actual.toString()`,
    );
  }
}
