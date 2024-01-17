import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("string", {
  fail_line_2: () => {
    assert({
      actual: `Hello,
my name is Damien`,
      expected: `Hello,
my name is Flore`,
    });
  },
  fail_many_lines_around: () => {
    assert({
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
    });
  },
  fail_too_much_lines_before: () => {
    assert({
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
    });
  },
  fail_double_slash_and_truncate_line: () => {
    assert({
      actual: `file:///dmail/documents/dev/jsenv-core/node_modules/@jsenv/assert/src/internal/something.js`,
      expected: `file:///dmail/documents/dev/jsenv-core/node_modules/@jsenv/assert/src/internal//something.js`,
    });
  },
  fail_exactly_on_line_break: () => {
    assert({
      actual: `abc`,
      expected: `ab
c`,
    });
  },
  fail_tab_should_be_a_space: () => {
    assert({
      actual: `	 `,
      expected: `  `,
    });
  },
  fail_too_short: () => {
    assert({
      actual: `a`,
      expected: `ab`,
    });
  },
  fail_too_short_line: () => {
    assert({
      actual: `Hello,
I am ben`,
      expected: `Hello,
 I am benjamin`,
    });
  },
  fail_too_long: () => {
    assert({
      actual: "hey/",
      expected: "hey",
    });
  },
  fail_too_long_line: () => {
    assert({
      actual: `Hello,
I am benjamin`,
      expected: `Hello,
I am ben`,
    });
  },
  fail_too_long_line_2: () => {
    assert({
      actual: `a
b`,
      expected: `a
`,
    });
  },
  fail_should_not_be_empty: () => {
    assert({
      actual: ``,
      expected: `aa`,
    });
  },
  fail_should_be_empty: () => {
    assert({
      actual: `aa`,
      expected: ``,
    });
  },
  fail_should_be_empty_blank_char: () => {
    assert({
      actual: String.fromCharCode(127),
      expected: "",
    });
  },
});
