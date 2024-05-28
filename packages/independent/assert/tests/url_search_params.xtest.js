import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("url_search_params", {
  ["foo added"]: () => {
    assert({
      actual: new URLSearchParams("foo=a"),
      expect: new URLSearchParams(),
    });
  },
  ["foo removed"]: () => {
    assert({
      actual: new URLSearchParams(),
      expect: new URLSearchParams("foo=a"),
    });
  },
  ["foo modified"]: () => {
    assert({
      actual: new URLSearchParams("foo=a"),
      expect: new URLSearchParams("foo=b"),
    });
  },
  ["foo second value added"]: () => {
    assert({
      actual: new URLSearchParams("foo=a&foo=a"),
      expect: new URLSearchParams("foo=a"),
    });
  },
  ["foo second value removed"]: () => {
    assert({
      actual: new URLSearchParams("foo=a"),
      expect: new URLSearchParams("foo=a&foo=a"),
    });
  },
  ["foo second value modified"]: () => {
    assert({
      actual: new URLSearchParams("foo=a&foo=b"),
      expect: new URLSearchParams("foo=a&foo=a"),
    });
  },
});
