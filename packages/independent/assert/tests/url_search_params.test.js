import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("url_search_params", ({ test }) => {
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
});
