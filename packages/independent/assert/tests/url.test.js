import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();
await startSnapshotTesting("url", {
  ["url port"]: () => {
    assert({
      actual: new URL("http://example.com"),
      expect: new URL("http://example.com:8000"),
    });
  },
  ["url hash modified"]: () => {
    assert({
      actual: new URL("http://example.com#foo"),
      expect: new URL("http://example.com#bar"),
    });
  },
  ["url hash removed"]: () => {
    assert({
      actual: new URL("http://example.com"),
      expect: new URL("http://example.com#bar"),
    });
  },
  ["url string and url"]: () => {
    assert({
      actual: "http://example.com",
      expect: new URL("http://example.com:8000"),
    });
  },
  ["url and url string"]: () => {
    assert({
      actual: new URL("http://example.com"),
      expect: "http://example.com:8000",
    });
  },
  ["url string and url string"]: () => {
    assert({
      actual: "http://example.com",
      expect: "http://example.com:8000",
    });
  },
  ["url and non url string"]: () => {
    assert({
      actual: new URL("http://example.com"),
      expect: "totoabcexample.com",
    });
  },
  ["non url string and url"]: () => {
    assert({
      actual: "totoabcexample.com",
      expect: new URL("http://example.com"),
    });
  },
  ["url and boolean"]: () => {
    assert({
      actual: new URL("http://example.com"),
      expect: true,
    });
  },
  ["url string inside a prop"]: () => {
    assert({
      actual: {
        a: "http://example.com",
        b: true,
      },
      expect: {
        a: "http://example.com",
        b: false,
      },
    });
  },
  ["url string and object with href"]: () => {
    assert({
      actual: "http://example.com",
      expect: {
        href: "http://example.com",
      },
    });
  },
  ["url object port and object with port"]: () => {
    assert({
      actual: new URL("http://example.com:45"),
      expect: {
        port: 45,
      },
    });
  },
  ["file protocol vs http protocol"]: () => {
    assert({
      actual: "http://example/file.txt",
      expect: "file://example/file.js",
    });
  },
  ["quote test"]: () => {
    assert({
      actual: "http://example.com",
      expect: `test"quotes`,
    });
  },
  ["double quote in url string"]: () => {
    assert({
      actual: `http://a.com"`,
      expect: `http://b.com"`,
    });
  },
  ["url origin is case insensitive"]: () => {
    assert({
      actual: {
        a: `http://example.com/page`,
        b: true,
      },
      expect: {
        a: `HTTP://EXAMPLE.COM/PAGE`,
        b: false,
      },
    });
  },
  ["internal string vs url object"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => "toto",
      },
      expect: new URL("http://toto.com"),
    });
  },
  ["internal url string vs url string"]: () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => "http://a.com/",
      },
      expect: "http://b.com",
    });
  },
});
