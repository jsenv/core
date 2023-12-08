import { assert } from "@jsenv/assert";
import { ensureAssertionErrorWithMessage } from "../ensureAssertionErrorWithMessage.js";

// mismatch one specific line
{
  const actual = `Hello,
my name is Damien`;
  const expected = `Hello,
my name is Flore`;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected character in string
--- details ---
Hello,
my name is Damien
           ^ unexpected "D", expected to continue with "Flore"
--- path ---
actual[18]#L2C12`,
    );
  }
}
// mismatch many lines before and after
{
  const actual = `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
Hello world
3abcdefghijklmnopqrstuvwxy
4abcdefghijklmnopqrstuvwxy`;
  const expected = `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
Hello europa
3abcdefghijklmnopqrstuvwxy
4abcdefghijklmnopqrstuvwxy`;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected character in string
--- details ---
1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
Hello world
      ^ unexpected "w", expected to continue with "europa"…
3abcdefghijklmnopqrstuvwxy
4abcdefghijklmnopqrstuvwxy
--- path ---
actual[59]#L3C7`,
    );
  }
}
// mismatch very long string before
{
  const actual = `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
3abcdefghijklmnopqrstuvwx
4abcdefghijklmnopqrstuvwxy
5abcdefghijklmnopqrstuvwxy
[Hello world]abcdefghijklmnopqrstuvwxyz`;
  const expected = `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
3abcdefghijklmnopqrstuvwx
4abcdefghijklmnopqrstuvwxy
5abcdefghijklmnopqrstuvwxy
[Hello france]abcdefghijklmnopqrstuvwxyz`;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected character in string
--- details ---
1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
3abcdefghijklmnopqrstuvwx
4abcdefghijklmnopqrstuvwxy
5abcdefghijklmnopqrstuvwxy
[Hello world]abcdefghijklmnopqrstuvwxyz
       ^ unexpected "w", expected to continue with "france]abcdefgh"…
--- path ---
actual[140]#L6C8`,
    );
  }
}
// mismatch double slash + truncate column
{
  const actual = `file:///dmail/documents/dev/jsenv-core/node_modules/@jsenv/assert/src/internal/something.js`;
  const expected = `file:///dmail/documents/dev/jsenv-core/node_modules/@jsenv/assert/src/internal//something.js`;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected character in string
--- details ---
…node_modules/@jsenv/assert/src/internal/something.js
                                         ^ unexpected "s", expected to continue with "/something.js"
--- path ---
actual[79]`,
    );
  }
}
// mismatch on line return
{
  const actual = `abc`;
  const expected = `ab
c`;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected character in string
--- details ---
abc
  ^ unexpected "c", expected to continue with "\\nc"
--- path ---
actual[2]`,
    );
  }
}
// mismatch tab vs space
{
  const actual = `	 `;
  const expected = `  `;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `unexpected character in string
--- details ---
\\t 
^ unexpected "\\t", expected to continue with "  "
--- path ---
actual[0]`,
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
a
 ^ expected to continue with "b"
--- path ---
actual`,
    );
  }
}
// too short (empty string found instead of string with 2 chars)
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

^ expected to continue with "aa"
--- path ---
actual`,
    );
  }
}
// too short (missing some chars on last line)
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
Hello,
I am ben
        ^ expected to continue with "jamin"
--- path ---
actual`,
    );
  }
}

// too long (extra chars on last line)
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
      `string is too long, it contains 5 extra characters
--- details ---
Hello,
I am benjamin
       ^ expected to end here, on "n"
--- path ---
actual`,
    );
  }
}
// too long last char
{
  const actual = "hey/";
  const expected = "hey";
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `string is too long, it contains one extra character
--- details ---
hey/
  ^ expected to end here, on "y"
--- path ---
actual`,
    );
  }
}
// too long (string given instead of empty string)
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
aa
^ an empty string was expected
--- path ---
actual`,
    );
  }
}
// too long (blank char given instead of empty string)
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
\\x7F
^ an empty string was expected
--- path ---
actual`,
    );
  }
}
// too long again
{
  const actual = `a
b`;
  const expected = `a
`;
  try {
    assert({ actual, expected });
  } catch (e) {
    ensureAssertionErrorWithMessage(
      e,
      `string is too long, it contains one extra character
--- details ---
a
 ^ expected to end here, on "\\n"
b
--- path ---
actual`,
    );
  }
}
