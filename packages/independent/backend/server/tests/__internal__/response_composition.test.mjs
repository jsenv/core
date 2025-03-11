import { composeTwoResponses } from "@jsenv/server/src/internal/response_composition.js";
import { snapshotTests } from "@jsenv/snapshot";

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", () => {
    return composeTwoResponses(
      {
        headers: { foo: true },
      },
      {
        headers: { foo: false },
      },
    );
  });

  test("1_with_headers", () => {
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

  test("2_etag_left_only", () => {
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

  test("2_etag_override", () => {
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
