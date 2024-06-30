import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("url", ({ test }) => {
  test("url object port", () => {
    assert({
      actual: new URL("http://example.com"),
      expect: new URL("http://example.com:8000"),
    });
  });
  test("url string port", () => {
    assert({
      actual: "http://example.com",
      expect: "http://example.com:8000",
    });
  });
  test("url string vs url object port", () => {
    assert({
      actual: "http://example.com",
      expect: new URL("http://example.com:8000"),
    });
  });
  url_search: {
    test("url search param modified", () => {
      assert({
        actual: new URL("http://example.com?foo=a"),
        expect: new URL("http://example.com?foo=b"),
      });
    });
    test("url search param added", () => {
      assert({
        actual: new URL("http://example.com?foo=a"),
        expect: new URL("http://example.com"),
      });
    });
    test("url search param added 2", () => {
      assert({
        actual: new URL("http://example.com?foo=a&bar=b"),
        expect: new URL("http://example.com?foo=a"),
      });
    });
    test("url search param removed", () => {
      assert({
        actual: new URL("http://example.com"),
        expect: new URL("http://example.com?foo=a"),
      });
    });
    test("url search param removed 2", () => {
      assert({
        actual: new URL("http://example.com?foo=a"),
        expect: new URL("http://example.com?foo=a&bar=b"),
      });
    });
    test("multi search param 2nd value modified", () => {
      assert({
        actual: "http://example.com?foo=a&foo=b&foo=a",
        expect: "http://example.com?foo=a&foo=a&foo=a",
      });
    });
    test("adding multi search", () => {
      assert({
        actual: "http://example.com?foo=a&foo=b",
        expect: "http://example.com?foo=a",
      });
    });
    test("multi search adding a 3rd param", () => {
      assert({
        actual: "http://example.com?foo=a&foo=a&foo=a",
        expect: "http://example.com?foo=a&foo=a",
      });
    });
    test("multi search removing a 3rd param", () => {
      assert({
        actual: "http://example.com?foo=a&foo=a",
        expect: "http://example.com?foo=a&foo=a&foo=a",
      });
    });
    test("removing multi search", () => {
      assert({
        actual: "http://example.com?foo=a",
        expect: "http://example.com?foo=a&foo=b",
      });
    });
    test("url search param + vs space", () => {
      assert({
        actual: {
          a: `http://example.com?a=+&b=1`,
          b: true,
        },
        expect: {
          a: `http://example.com?a= &b=1`,
          b: false,
        },
      });
    });
    test("param order modified and value modified", () => {
      assert({
        actual: "http://example.com?foo=a&bar=a",
        expect: "http://example.com?bar=b&foo=b",
      });
    });
  }
  test("url hash modified", () => {
    assert({
      actual: new URL("http://example.com#foo"),
      expect: new URL("http://example.com#bar"),
    });
  });
  test("url hash removed", () => {
    assert({
      actual: new URL("http://example.com"),
      expect: new URL("http://example.com#bar"),
    });
  });
  test("url and url string", () => {
    assert({
      actual: new URL("http://example.com"),
      expect: "http://example.com:8000",
    });
  });
  test("url string and url string", () => {
    assert({
      actual: "http://example.com",
      expect: "http://example.com:8000",
    });
  });
  test("url and non url string", () => {
    assert({
      actual: new URL("http://example.com"),
      expect: "totoabcexample.com",
    });
  });
  test("non url string and url", () => {
    assert({
      actual: "totoabcexample.com",
      expect: new URL("http://example.com"),
    });
  });
  test("url and boolean", () => {
    assert({
      actual: new URL("http://example.com"),
      expect: true,
    });
  });
  test("url string inside a prop", () => {
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
  });
  test("url string and object with href", () => {
    assert({
      actual: "http://example.com",
      expect: {
        href: "http://example.com",
      },
    });
  });
  test("url object port and object with port", () => {
    assert({
      actual: new URL("http://example.com:45"),
      expect: {
        port: 45,
      },
    });
  });
  test("file protocol vs http protocol", () => {
    assert({
      actual: "http://example/file.txt",
      expect: "file://example/file.js",
    });
  });
  test("url origin is case insensitive", () => {
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
  });
  test("internal string vs url object", () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => "toto",
      },
      expect: new URL("http://toto.com"),
    });
  });
  test("internal url string vs url string", () => {
    assert({
      actual: {
        [Symbol.toStringTag]: "Signal",
        valueOf: () => "http://a.com/",
      },
      expect: "http://b.com",
    });
  });
});
