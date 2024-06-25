import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("string_multline", ({ test }) => {
  test("add empty line", () => {
    assert({
      actual: `\n`,
      expect: ``,
    });
  });
  test("remove empty line", () => {
    assert({
      actual: ``,
      expect: `\n`,
    });
  });
  test("one line vs two lines", () => {
    assert({
      actual: "Hel",
      expect: `Hello
world`,
    });
  });
  test("second line contains extra chars", () => {
    assert({
      actual: {
        foo: `Hello,
my name is Benjamin
and my brother is joe`,
      },
      expect: {
        foo: `Hello,
my name is Ben
and my brother is joe`,
      },
    });
  });
  test("second line differs", () => {
    assert({
      actual: `Hello
world`,
      expect: `Hello
france`,
    });
  });
  test("too many lines before and after", () => {
    assert({
      actual: `one
two
three
four/true
five
six
seven/0`,
      expect: `one
two
three
four/false
five
six
seven/1`,
      MAX_CONTEXT_BEFORE_DIFF: 2,
      MAX_CONTEXT_AFTER_DIFF: 2,
    });
  });
  test("many lines added", () => {
    assert({
      actual: `one
two
three
four
five six`,
      expect: `one`,
    });
  });
  test("many lines removed", () => {
    assert({
      actual: `one`,
      expect: `one
two
three
four
five six`,
    });
  });
  // goal here is to ensure "," is preserved around multiline
  test("prop before and after", () => {
    assert({
      actual: {
        a: true,
        b: `a\nb`,
        c: true,
      },
      expect: {
        a: true,
        b: `a\nc`,
        c: true,
      },
    });
  });
  test("new line escaped", () => {
    assert({
      actual: {
        a: `\\n`,
        b: true,
      },
      expect: {
        a: `\\n`,
        b: false,
      },
    });
  });
  test("multiline without diff", () => {
    assert({
      actual: {
        a: "a\nb",
        b: true,
      },
      expect: {
        a: `a\nb`,
        b: false,
      },
    });
  });
  test("many lines around", () => {
    assert({
      actual: `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
Hello world
3abcdefghijklmnopqrstuvwxy
4abcdefghijklmnopqrstuvwxy`,
      expect: `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
Hello europa
3abcdefghijklmnopqrstuvwxy
4abcdefghijklmnopqrstuvwxy`,
    });
  });
  test("many lines before", () => {
    assert({
      actual: `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
3abcdefghijklmnopqrstuvwx
4abcdefghijklmnopqrstuvwxy
5abcdefghijklmnopqrstuvwxy
[Hello world]abcdefghijklmnopqrstuvwxyz`,
      expect: `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
3abcdefghijklmnopqrstuvwx
4abcdefghijklmnopqrstuvwxy
5abcdefghijklmnopqrstuvwxy
[Hello france]abcdefghijklmnopqrstuvwxyz`,
    });
  });
  test("exactly on line break", () => {
    assert({
      actual: `abc`,
      expect: `ab\nc`,
    });
  });
});
