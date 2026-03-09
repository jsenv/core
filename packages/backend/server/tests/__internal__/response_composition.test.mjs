import { composeTwoResponses } from "@jsenv/server/src/internal/response_composition.js";
import { snapshotTests } from "@jsenv/snapshot";

await snapshotTests(import.meta.url, ({ test }) => {
  test("basic", () => {
    return composeTwoResponses(
      {
        headers: { foo: true },
      },
      {
        headers: { foo: false },
      },
    );
  });

  test("with_headers", () => {
    return composeTwoResponses(
      {
        headers: {
          "access-control-allow-headers": "a, b",
        },
      },
      {
        headers: {
          "access-control-allow-headers": "c, a",
          "content-type": "text/javascript",
        },
      },
    );
  });

  test("etag_left_only", () => {
    return composeTwoResponses(
      {
        headers: {
          eTag: "toto",
        },
      },
      {
        headers: {},
      },
    );
  });

  test("etag_override", () => {
    return composeTwoResponses(
      {
        headers: {
          etag: "foo",
        },
      },
      {
        headers: {
          eTag: "bar",
        },
      },
    );
  });
});
