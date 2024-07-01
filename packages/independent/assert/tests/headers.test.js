import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("headers", ({ test }) => {
  test("content-type added", () => {
    assert({
      actual: new Headers({
        "content-type": "text/xml",
      }),
      expect: new Headers(),
    });
  });
  test("content-type removed", () => {
    assert({
      actual: new Headers({}),
      expect: new Headers({
        "content-type": "text/xml",
      }),
    });
  });
  test("content-type modified", () => {
    assert({
      actual: new Headers({
        "content-type": "text/css",
      }),
      expect: new Headers({
        "content-type": "text/xml",
      }),
    });
  });
  test("content-type multi diff", () => {
    assert({
      actual: new Headers({
        "content-type": "text/xml, text/css",
      }),
      expect: new Headers({
        "content-type": "text/xml, text/html",
      }),
    });
  });
  // From an HTTP perspective the whitspaces (and even the order of header values)
  // does not matter.
  // However if a change in the code is adding/removing whitespaces in header values
  // people would expect assert to fail as a testimony of their changes
  // so header value comparison is whitespace sensitive
  test("content-type spacing diff", () => {
    assert({
      actual: new Headers({
        "content-type": "text/xml,text/css",
      }),
      expect: new Headers({
        "content-type": "text/xml, text/css",
      }),
    });
  });
  set_cookie: {
    test("set cookie added", () => {
      assert({
        actual: new Headers({
          "set-cookie": "a=1",
        }),
        expect: new Headers({}),
      });
    });
    test("set cookie removed", () => {
      assert({
        actual: new Headers({}),
        expect: new Headers({
          "set-cookie": "a=1;",
        }),
      });
    });
    test("cookie added", () => {
      assert({
        actual: new Headers({
          "set-cookie": "a=1,b=2",
        }),
        expect: new Headers({
          "set-cookie": "a=1",
        }),
      });
    });
    test("cookie removed", () => {
      assert({
        actual: new Headers({
          "set-cookie": "a=1",
        }),
        expect: new Headers({
          "set-cookie": "a=1,b=2,",
        }),
      });
    });
    test("cookie order modified", () => {
      assert({
        actual: new Headers({
          "set-cookie": "a=1,b=2",
        }),
        expect: new Headers({
          "set-cookie": "b=2,a=1",
        }),
      });
    });
    // see https://stackoverflow.com/questions/4056306/how-to-handle-multiple-cookies-with-the-same-name
    test("cookie name used several times", () => {
      assert({
        actual: new Headers({
          "set-cookie": "a=1,a=2",
        }),
        expect: new Headers({
          "set-cookie": "a=9,a=8",
        }),
      });
    });
    test("cookie becomes secure", () => {
      assert({
        actual: new Headers({
          "set-cookie": "a=1; Secure",
        }),
        expect: new Headers({
          "set-cookie": "a=1",
        }),
      });
    });
  }
  accept: {
    test("accept", () => {
      assert({
        actual: new Headers({
          accept: "text/html, application/xml;q=0.9, */*;q=0.8",
        }),
        expect: new Headers({
          accept: "text/html, application/xml;q=0.8, */*;q=0.7, text/css",
        }),
      });
    });
    test("accept diff on non standard attribute", () => {
      assert({
        actual: new Headers({
          accept: "text/html; a=1; b=2",
        }),
        expect: new Headers({
          accept: "text/html; a=9; b=9",
        }),
      });
    });
  }
  accept_encoding: {
    test("add accepted encoding", () => {
      assert({
        actual: new Headers({
          "accept-encoding": "deflate, gzip, br",
        }),
        expect: new Headers({
          "accept-encoding": "deflate, gzip",
        }),
      });
    });
    test("remove accepted encoding", () => {
      assert({
        actual: new Headers({
          "accept-encoding": "deflate, gzip",
        }),
        expect: new Headers({
          "accept-encoding": "deflate, gzip, br",
        }),
      });
    });
    test("accept-encoding diff on q", () => {
      assert({
        actual: new Headers({
          "accept-encoding": "deflate, gzip;q=1.0, *;q=0.5",
        }),
        expect: new Headers({
          "accept-encoding": "deflate, gzip;q=0.9, *;q=0.4",
        }),
      });
    });
  }
  accept_language: {
    test("accept-language", () => {
      assert({
        actual: new Headers({
          "accept-language": "fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5",
        }),
        expect: new Headers({
          "accept-language": "en-US,en;q=0.5",
        }),
      });
    });
  }
  server_timings: {
    test("add metric in server timing", () => {
      assert({
        actual: new Headers({
          "server-timing": `cpu;dur=2.4, app;dur=47.2`,
        }),
        expect: new Headers({
          "server-timing": `cpu;dur=2.4`,
        }),
      });
    });
    test("remove metric in server timing", () => {
      assert({
        actual: new Headers({
          "server-timing": `cpu;dur=2.4`,
        }),
        expect: new Headers({
          "server-timing": `cpu;dur=2.4, app;dur=47.2`,
        }),
      });
    });
    test("add description to a metric", () => {
      assert({
        actual: new Headers({
          "server-timing": `cache;dur=23.2`,
        }),
        expect: new Headers({
          "server-timing": `cache;desc="Cache Read";dur=23.2`,
        }),
      });
    });
  }
  content_length: {
    test("content length diff", () => {
      assert({
        actual: new Headers({
          "content-length": "1456",
        }),
        expect: new Headers({
          "content-length": "1356",
        }),
      });
    });
  }
});
