import { assert } from "@jsenv/assert";

import { pickContentType } from "@jsenv/server";

{
  const actual = pickContentType(
    {
      headers: {
        accept: "text/html",
      },
    },
    ["text/html"],
  );
  const expect = "text/html";
  assert({ actual, expect });
}

{
  const actual = pickContentType(
    {
      headers: {
        accept: "text/html",
      },
    },
    ["text/plain"],
  );
  const expect = null;
  assert({ actual, expect });
}

{
  const actual = pickContentType(
    {
      headers: {
        accept: "text/*",
      },
    },
    ["text/plain"],
  );
  const expect = "text/plain";
  assert({ actual, expect });
}

{
  const actual = pickContentType(
    {
      headers: {
        accept: "image/*",
      },
    },
    ["text/plain"],
  );
  const expect = null;
  assert({ actual, expect });
}

{
  const actual = pickContentType(
    {
      headers: {
        accept: "*/*",
      },
    },
    ["text/plain"],
  );
  const expect = "text/plain";
  assert({ actual, expect });
}

{
  const actual = pickContentType(
    {
      headers: {
        accept: "text/plain, text/javascript",
      },
    },
    ["text/javascript"],
  );
  const expect = "text/javascript";
  assert({ actual, expect });
}

{
  const actual = pickContentType(
    {
      headers: {
        accept: "text/plain, text/javascript",
      },
    },
    ["application/pdf"],
  );
  const expect = null;
  assert({ actual, expect });
}

{
  const actual = pickContentType(
    {
      headers: {
        accept: "text/plain, */*",
      },
    },
    ["text/javascript"],
  );
  const expect = "text/javascript";
  assert({ actual, expect });
}

{
  const actual = pickContentType(
    {
      headers: {
        accept: "text/plain, */*;q=0.1",
      },
    },
    ["text/javascript"],
  );
  const expect = "text/javascript";
  assert({ actual, expect });
}
