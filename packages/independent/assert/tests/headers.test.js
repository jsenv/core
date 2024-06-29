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
  // TODO: cookies, accept, etc..
});
