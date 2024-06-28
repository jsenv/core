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
  // property name
  test("single quote", () => {
    assert({
      actual: {
        "I'm": true,
      },
      expect: {
        "I'm": false,
      },
    });
  });
  test("double quote", () => {
    assert({
      actual: {
        'He is "crazy"': true,
      },
      expect: {
        'He is "crazy"': false,
      },
    });
  });
  test("single and double", () => {
    assert({
      actual: {
        [`You're "crazy"`]: true,
      },
      expect: {
        [`You're "crazy"`]: false,
      },
    });
  });
  // url
  test("double quote in url string", () => {
    assert({
      actual: `http://a.com"`,
      expect: `http://b.com"`,
    });
  });
  test("double quote in url search param key", () => {
    assert({
      actual: `http://a.com?fo"=true`,
      expect: `http://a.com?fo"=false`,
    });
  });
  test("double quote in url search param value", () => {
    assert({
      actual: `http://a.com?foo="dam"`,
      expect: `http://a.com?foo="seb"`,
    });
  });
  test("double quote in url pathname", () => {
    assert({
      actual: `http://a.com/dir/"dam"`,
      expect: `http://b.com/dir/"dam"`,
    });
  });
  test("url vs string", () => {
    assert({
      actual: "http://example.com",
      expect: `test"quotes`,
    });
  });
});
