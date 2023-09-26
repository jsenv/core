import { assert } from "@jsenv/assert";
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js";

// mismatch one specific line
// {
//   const actual = `Hello,
// my name is Damien`;
//   const expected = `Hello,
// my name is Flore`;
//   try {
//     assert({ actual, expected });
//   } catch (e) {
//     ensureAssertionErrorWithMessage(
//       e,
//       `string mismatch, "D" was found instead of "F"
// --- details ---
// "Hello,
// my name is Damien"
//            ^ unexpected character, expected string continues with "Flore"
// --- path ---
// actual[18]#L2C12`,
//     );
//   }
// }
// // mismatch many lines before and after
// {
//   const actual = `1abcdefghijklmnopqrstuvwx
// 2abcdefghijklmnopqrstuvwxy
// Hello world
// 3abcdefghijklmnopqrstuvwxy
// 4abcdefghijklmnopqrstuvwxy`;
//   const expected = `1abcdefghijklmnopqrstuvwx
// 2abcdefghijklmnopqrstuvwxy
// Hello europa
// 3abcdefghijklmnopqrstuvwxy
// 4abcdefghijklmnopqrstuvwxy`;
//   try {
//     assert({ actual, expected });
//   } catch (e) {
//     ensureAssertionErrorWithMessage(
//       e,
//       `string mismatch, "w" was found instead of "e"
// --- details ---
// "1abcdefghijklmnopqrstuvwx
// 2abcdefghijklmnopqrstuvwxy
// Hello world"…
//       ^ unexpected character, expected string continues with "europa"…
// --- path ---
// actual[59]#L3C7`,
//     );
//   }
// }
// // mismatch very long string before
// {
//   const actual = `1abcdefghijklmnopqrstuvwx
// 2abcdefghijklmnopqrstuvwxy
// 3abcdefghijklmnopqrstuvwx
// 4abcdefghijklmnopqrstuvwxy
// 5abcdefghijklmnopqrstuvwxy
// [Hello world]abcdefghijklmnopqrstuvwxyz`;
//   const expected = `1abcdefghijklmnopqrstuvwx
// 2abcdefghijklmnopqrstuvwxy
// 3abcdefghijklmnopqrstuvwx
// 4abcdefghijklmnopqrstuvwxy
// 5abcdefghijklmnopqrstuvwxy
// [Hello france]abcdefghijklmnopqrstuvwxyz`;
//   try {
//     assert({ actual, expected });
//   } catch (e) {
//     ensureAssertionErrorWithMessage(
//       e,
//       `string mismatch, "w" was found instead of "f"
// --- details ---
// …"nopqrstuvwxy
// 3abcdefghijklmnopqrstuvwx
// 4abcdefghijklmnopqrstuvwxy
// 5abcdefghijklmnopqrstuvwxy
// [Hello world]abcdefghijklmnopqrstuvwxyz"
//        ^ unexpected character, expected string continues with "france]abcdefgh"…
// --- path ---
// actual[140]#L6C8`,
//     );
//   }
// }
// // mismatch on line return
// {
//   const actual = `abc`;
//   const expected = `ab
// c`;
//   try {
//     assert({ actual, expected });
//   } catch (e) {
//     ensureAssertionErrorWithMessage(
//       e,
//       `string mismatch, "c" was found instead of "\\n"
// --- details ---
// "abc"
//    ^ unexpected character, expected string continues with "\\nc"
// --- path ---
// actual[2]`,
//     );
//   }
// }
// // mismatch tab vs space
// {
//   const actual = `	 `;
//   const expected = `  `;
//   try {
//     assert({ actual, expected });
//   } catch (e) {
//     ensureAssertionErrorWithMessage(
//       e,
//       `string mismatch, "\\t" was found instead of " "
// --- details ---
// "\\t "
//  ^ unexpected character, expected string continues with "  "
// --- path ---
// actual[0]`,
//     );
//   }
// }

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
"Hello,
I am ben"
        ^ expected string continues with "jamin"
--- path ---
actual`,
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
{
  const actual = `Hello,
I am benjamin`;
  const expected = `Hello,
I am ben`;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `string is too short, 5 characters are missing
--- details ---
"Hello,
I am ben"
        ^ expected string continues with "jamin"
--- path ---
actual`,
    );
  }
}
