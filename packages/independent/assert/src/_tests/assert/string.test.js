import { assert } from "@jsenv/assert";
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js";

// {
//   const actual = String.fromCharCode(127);
//   const expected = "";
//   try {
//     assert({ actual, expected });
//   } catch (e) {
//     ensureAssertionErrorWithMessage(
//       e,
//       `string is too long, it has 1 extra character
// --- trace ---
// \\x7F
// ^ unexpected char
// --- found ---
// 2 characters
// --- expected ---
// 1 character
// --- path ---
// actual`,
//     );
//   }
// }

// {
//   const actual = `	`;
//   const expected = ` `;
//   try {
//     assert({ actual, expected });
//   } catch (e) {
//     ensureAssertionErrorWithMessage(
//       e,
//       `unexpected character, "\\t" was found instead of " "
// --- details ---

// ^ unexpected character
// --- path ---
// actual[0]`,
//     );
//   }
// }

// {
//   const actual = `aa`;
//   const expected = ``;
//   try {
//     assert({ actual, expected });
//   } catch (e) {
//     ensureAssertionErrorWithMessage(
//       e,
//       `unequal strings
// --- found ---
// "aa"
// --- expected ---
// ""
// --- path ---
// actual
// --- details ---
// string found is too long, it has 2 extra characters`,
//     );
//   }
// }

{
  const actual = `a`;
  const expected = `ab`;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected end of string after character "a"
--- details ---
ab
^ unexpected end of string
--- path ---
actual[1]`,
    );
  }
}

// {
//   const actual = ``;
//   const expected = `aa`;
//   try {
//     assert({ actual, expected });
//   } catch (e) {
//     ensureAssertionErrorWithMessage(
//       e,
//       `unequal strings
// --- found ---
// ""
// --- expected ---
// "aa"
// --- path ---
// actual
// --- details ---
// string found is too short, 2 characters are missing`,
//     );
//   }
// }
