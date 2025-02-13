import { assert } from "@jsenv/assert";
import { snapshotAssertTests } from "@jsenv/assert/tests/snapshot_assert.js";

await snapshotAssertTests(import.meta.url, ({ test }) => {
  test("foo added", () => {
    assert({
      actual: new URLSearchParams("foo=a"),
      expect: new URLSearchParams(),
    });
  });
  test("foo removed", () => {
    assert({
      actual: new URLSearchParams(),
      expect: new URLSearchParams("foo=a"),
    });
  });
  test("foo modified", () => {
    assert({
      actual: new URLSearchParams("foo=a"),
      expect: new URLSearchParams("foo=b"),
    });
  });
  test("foo second value added", () => {
    assert({
      actual: new URLSearchParams("foo=a&foo=a"),
      expect: new URLSearchParams("foo=a"),
    });
  });
  test("foo second value removed", () => {
    assert({
      actual: new URLSearchParams("foo=a"),
      expect: new URLSearchParams("foo=a&foo=a"),
    });
  });
  test("foo second value modified", () => {
    assert({
      actual: new URLSearchParams("foo=a&foo=b"),
      expect: new URLSearchParams("foo=a&foo=a"),
    });
  });
  test("param order modified and value modified", () => {
    assert({
      actual: new URLSearchParams("foo=a&bar=a"),
      expect: new URLSearchParams("bar=b&foo=b"),
    });
  });
  test("search params sort", () => {
    assert({
      actual: new URLSearchParams("foo=a&bar=a"),
      expect: new URLSearchParams("bar=b&foo=b"),
      order: "sort",
    });
  });
});
