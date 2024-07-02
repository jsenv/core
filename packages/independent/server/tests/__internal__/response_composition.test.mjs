import { assert } from "@jsenv/assert";

import { composeTwoResponses } from "@jsenv/server/src/internal/response_composition.js";

{
  const actual = composeTwoResponses(
    {
      headers: { foo: true },
    },
    {
      headers: { foo: false },
    },
  );
  const expect = {
    status: undefined,
    statusText: undefined,
    statusMessage: undefined,
    headers: {
      foo: false,
    },
    body: undefined,
    bodyEncoding: undefined,
    timing: undefined,
  };
  assert({ actual, expect });
}

{
  const actual = composeTwoResponses(
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
  const expect = {
    status: undefined,
    statusText: undefined,
    statusMessage: undefined,
    headers: {
      "access-control-allow-headers": "a, b, c",
      "content-type": "text/javascript",
    },
    body: undefined,
    bodyEncoding: undefined,
    timing: undefined,
  };
  assert({ actual, expect });
}

{
  const response = composeTwoResponses(
    {
      headers: {
        eTag: "toto",
      },
    },
    {
      headers: {},
    },
  );
  const actual = response.headers;
  const expect = {
    etag: "toto",
  };
  assert({ actual, expect });
}

{
  const response = composeTwoResponses(
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
  const actual = response.headers;
  const expect = {
    etag: "bar",
  };
  assert({ actual, expect });
}

{
  const response = composeTwoResponses(
    {
      headers: {
        eTag: "foo",
      },
    },
    {
      headers: {
        etag: "bar",
      },
    },
  );
  const actual = response.headers;
  const expect = {
    etag: "bar",
  };
  assert({ actual, expect });
}
