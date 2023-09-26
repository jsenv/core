import { assert } from "@jsenv/assert";
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js";
import { executeInNewContext } from "../executeInNewContext.js";

{
  const actual = new Error();
  const expected = new Error();
  assert({ actual, expected });
}

{
  const actual = await executeInNewContext("new Error()");
  const expected = await executeInNewContext("new Error()");
  assert({ actual, expected });
}

{
  const actual = await executeInNewContext("new Error()");
  const expected = new Error();
  assert({ actual, expected });
}

{
  const actual = new Error();
  const expected = await executeInNewContext("new Error()");
  assert({ actual, expected });
}

{
  const actual = new Error("foo");
  const expected = new Error("bar");
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected error message, "f" was found instead of "b" at index 0
--- details ---
"foo"
 ^ unexpected character, expected string continues with "bar"
--- path ---
actual.message[0]`,
    );
  }
}

if (typeof global === "object") {
  const actual = new Error();
  const expected = new TypeError();
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unequal prototypes
--- prototype found ---
global.Error.prototype
--- prototype expected ---
global.TypeError.prototype
--- path ---
actual[[Prototype]]`,
    );
  }
}

// beware test below because depending on node version
// Object.keys(Object.getPrototypeOf(new TypeError()))
// might differ. For instance node 8.5 returns name before constructor
// and node 8.9.0 returns constructor before name
if (typeof global === "object") {
  const actual = new Error();
  const expected = await executeInNewContext("new TypeError()");
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unequal prototypes
--- prototype found ---
global.Error.prototype
--- prototype expected ---
TypeError({
  "constructor": function () {/* hidden */},
  "name": "TypeError",
  "message": ""
})
--- path ---
actual[[Prototype]]`,
    );
  }
}
