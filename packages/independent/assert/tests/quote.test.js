import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("quote", ({ test }) => {
  // string
  test("string contains escaped double quote", () => {
    assert({
      // prettier-ignore
      actual: "I\\\"m dam",
      // prettier-ignore
      expect: "I\\\"m seb",
    });
  });
  test("single quote best in actual", () => {
    assert({
      actual: `My name is "dam"`,
      expect: `My name is ZdamZ`,
    });
  });
  test("single quote best in expect", () => {
    assert({
      actual: `My name is ZdamZ`,
      expect: `My name is "dam"`,
    });
  });
  test("template quote best in expect", () => {
    assert({
      actual: `I'm "zac"`,
      expect: `I'm "dam"`,
    });
  });
  test("double best and must be escaped", () => {
    assert({
      actual: `START "dam" \`''' END`,
      expect: `START "zac" \`''' END`,
    });
  });
  // url
  test("double quote in url string", () => {
    assert({
      actual: `http://a.com"`,
      expect: `http://b.com"`,
    });
  });
  test("quote test", () => {
    assert({
      actual: "http://example.com",
      expect: `test"quotes`,
    });
  });
});
