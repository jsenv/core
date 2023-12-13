import stripAnsi from "strip-ansi";

import { assert } from "@jsenv/assert";

const test = ({ actual, expected, expectedMessage }) => {
  if (!expectedMessage) {
    assert({ actual, expected });
    return;
  }
  try {
    assert({ actual, expected });
    throw new Error("should throw");
  } catch (e) {
    if (!assert.isAssertionError(e)) {
      throw new Error(`assertionError expected, got ${e.stack}`);
    }
    const message = stripAnsi(e.message);
    if (message !== expectedMessage) {
      throw new Error(`unequal assertion error messages
___________________ MESSAGE FOUND ___________________
${message}
___________________ MESSAGE EXPECTED ___________________
${expectedMessage}`);
    }
  }
};

// mismatch one specific line
test({
  actual: `Hello,
my name is Damien`,
  expected: `Hello,
my name is Flore`,
  expectedMessage: `unexpected character in string
--- details ---
1 | Hello,
2 | my name is Damien
               ^
unexpected "D", expected to continue with "Flore"
--- path ---
actual`,
});

// mismatch many lines before and after
test({
  actual: `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
Hello world
3abcdefghijklmnopqrstuvwxy
4abcdefghijklmnopqrstuvwxy`,
  expected: `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
Hello europa
3abcdefghijklmnopqrstuvwxy
4abcdefghijklmnopqrstuvwxy`,
  expectedMessage: `unexpected character in string
--- details ---
1 | 1abcdefghijklmnopqrstuvwx
2 | 2abcdefghijklmnopqrstuvwxy
3 | Hello world
          ^
unexpected "w", expected to continue with "europa"…
4 | 3abcdefghijklmnopqrstuvwxy
5 | 4abcdefghijklmnopqrstuvwxy
--- path ---
actual`,
});

// mismatch very long string before
test({
  actual: `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
3abcdefghijklmnopqrstuvwx
4abcdefghijklmnopqrstuvwxy
5abcdefghijklmnopqrstuvwxy
[Hello world]abcdefghijklmnopqrstuvwxyz`,
  expected: `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
3abcdefghijklmnopqrstuvwx
4abcdefghijklmnopqrstuvwxy
5abcdefghijklmnopqrstuvwxy
[Hello france]abcdefghijklmnopqrstuvwxyz`,
  expectedMessage: `unexpected character in string
--- details ---
1 | 1abcdefghijklmnopqrstuvwx
2 | 2abcdefghijklmnopqrstuvwxy
3 | 3abcdefghijklmnopqrstuvwx
4 | 4abcdefghijklmnopqrstuvwxy
5 | 5abcdefghijklmnopqrstuvwxy
6 | [Hello world]abcdefghijklmnopqrstuvwxyz
           ^
unexpected "w", expected to continue with "france]abcdefghijklmnopqrstuvw"…
--- path ---
actual`,
});

// mismatch double slash + truncate column
test({
  actual: `file:///dmail/documents/dev/jsenv-core/node_modules/@jsenv/assert/src/internal/something.js`,
  expected: `file:///dmail/documents/dev/jsenv-core/node_modules/@jsenv/assert/src/internal//something.js`,
  expectedMessage: `unexpected character in string
--- details ---
…ode_modules/@jsenv/assert/src/internal/something.js
                                        ^
unexpected "s", expected to continue with "/something.js"
--- path ---
actual`,
});

// mismatch on line return
test({
  actual: `abc`,
  expected: `ab
c`,
  expectedMessage: `unexpected character in string
--- details ---
abc
  ^
unexpected "c", expected to continue with "\\nc"
--- path ---
actual`,
});

// mismatch tab vs space
test({
  actual: `	 `,
  expected: `  `,
  expectedMessage: `unexpected character in string
--- details ---
\\t 
^
unexpected "\\t", expected to continue with "  "
--- path ---
actual`,
});

// too short
test({
  actual: `a`,
  expected: `ab`,
  expectedMessage: `string is too short, one character is missing
--- details ---
a
 ^
expected to continue with "b"
--- path ---
actual`,
});

// too short (empty string found instead of string with 2 chars)
test({
  actual: ``,
  expected: `aa`,
  expectedMessage: `string is too short, 2 characters are missing
--- details ---

^
expected to continue with "aa"
--- path ---
actual`,
});

// too short (missing some chars on last line)
test({
  actual: `Hello,
I am ben`,
  expected: `Hello,
I am benjamin`,
  expectedMessage: `string is too short, 5 characters are missing
--- details ---
1 | Hello,
2 | I am ben
            ^
expected to continue with "jamin"
--- path ---
actual`,
});

// too long (extra chars on last line)
test({
  actual: `Hello,
I am benjamin`,
  expected: `Hello,
I am ben`,
  expectedMessage: `string is too long, it contains 5 extra characters
--- details ---
1 | Hello,
2 | I am benjamin
           ^
expected to end here, on "n"
--- path ---
actual`,
});

// too long last char
test({
  actual: "hey/",
  expected: "hey",
  expectedMessage: `string is too long, it contains one extra character
--- details ---
hey/
  ^
expected to end here, on "y"
--- path ---
actual`,
});

// too long (string given instead of empty string)
test({
  actual: `aa`,
  expected: ``,
  expectedMessage: `string is too long, it contains 2 extra characters
--- details ---
aa
^
an empty string was expected
--- path ---
actual`,
});

// too long (blank char given instead of empty string)
test({
  actual: String.fromCharCode(127),
  expected: "",
  expectedMessage: `string is too long, it contains one extra character
--- details ---
\\x7F
^
an empty string was expected
--- path ---
actual`,
});

// too long again
test({
  actual: `a
b`,
  expected: `a
`,
  expectedMessage: `string is too long, it contains one extra character
--- details ---
1 | a
     ^
expected to end here, on "\\n"
2 | b
--- path ---
actual`,
});
