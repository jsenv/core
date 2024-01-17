import { assert } from "@jsenv/assert";
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js";

{
  const actual = 150;
  const expected = assert.between(100, 200);
  assert({ actual, expected });
}

{
  const actual = "toto";
  const expected = assert.between(100, 200);
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `not a number
--- found ---
"toto"
--- expected ---
a number between 100 and 200
--- path ---
actual`,
    );
  }
}

{
  const actual = 50;
  const expected = assert.between(100, 200);
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `too small
--- found ---
50
--- expected ---
between 100 and 200
--- path ---
actual`,
    );
  }
}

{
  const actual = 250;
  const expected = assert.between(100, 200);
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `too big
--- found ---
250
--- expected ---
between 100 and 200
--- path ---
actual`,
    );
  }
}
