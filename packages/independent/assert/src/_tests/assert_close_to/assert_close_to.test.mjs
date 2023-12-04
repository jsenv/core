import { assert } from "@jsenv/assert";
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js";

{
  const actual = 0.1 + 0.2;
  const expected = assert.closeTo(0.3);
  assert({ actual, expected });
}

{
  const actual = "toto";
  const expected = assert.closeTo(0.4);
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unequal values
--- found ---
"toto"
--- expected ---
0.4
--- path ---
actual`,
    );
  }
}

{
  const actual = 0.1 + 0.2;
  const expected = assert.closeTo(0.4);
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unequal values
--- found ---
0.30000000000000004
--- expected ---
0.4
--- path ---
actual`,
    );
  }
}
