import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("url", {
  ["url port"]: () => {
    assert({
      actual: new URL("http://example.com"),
      expected: new URL("http://example.com:8000"),
    });
  },
  ["url and url string"]: () => {
    assert({
      actual: new URL("http://example.com"),
      expected: "http://example.com:8000",
    });
  },
  ["url string and url"]: () => {
    assert({
      actual: "http://example.com",
      expected: new URL("http://example.com:8000"),
    });
  },
  ["url string and url string"]: () => {
    assert({
      actual: "http://example.com",
      expected: "http://example.com:8000",
    });
  },
  ["url and non url string"]: () => {
    assert({
      actual: new URL("http://example.com"),
      expected: "totoabcexample.com",
    });
  },
  ["non url string and url"]: () => {
    assert({
      actual: "totoabcexample.com",
      expected: new URL("http://example.com"),
    });
  },
  ["url and boolean"]: () => {
    assert({
      actual: new URL("http://example.com"),
      expected: true,
    });
  },
});
