/* eslint-disable accessor-pairs */
import { assert } from "@jsenv/assert";
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js";

{
  const actual = Object.defineProperty({}, "foo", { set: () => {} });
  const expected = Object.defineProperty({}, "foo", { set: () => {} });
  assert({ actual, expected });
}

{
  // eslint-disable-next-line no-inner-declarations
  function set() {}
  const actual = Object.defineProperty({}, "foo", {});
  const expected = Object.defineProperty({}, "foo", { set });
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unequal values
--- found ---
undefined
--- expected ---
function ${set.name}() {/* hidden */}
--- path ---
actual.foo[[Set]]`,
    );
  }
}

{
  // eslint-disable-next-line no-inner-declarations
  function set() {}
  const actual = Object.defineProperty({}, "foo", { set });
  const expected = Object.defineProperty({}, "foo", {});
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unequal values
--- found ---
function ${set.name}() {/* hidden */}
--- expected ---
undefined
--- path ---
actual.foo[[Set]]`,
    );
  }
}

{
  const actualSetter = () => 1;
  const expectedSetter = () => 1;
  try {
    const actual = Object.defineProperty({}, "foo", { set: actualSetter });
    const expected = Object.defineProperty({}, "foo", { set: expectedSetter });
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unequal function names
--- found ---
"actualSetter"
--- expected ---
"expectedSetter"
--- path ---
actual.foo[[Set]].name
--- details ---
unexpected character at index 0, "a" was found instead of "e"`,
    );
  }
}
