import { assert } from "@jsenv/assert";

import { DATA_URL } from "@jsenv/urls";

{
  const actual = DATA_URL.parse("data:,");
  const expect = {
    contentType: "text/plain;charset=US-ASCII",
    base64Flag: false,
    data: "",
  };
  assert({ actual, expect });
}

{
  const actual = DATA_URL.parse("data:,Hello%2C%20World!");
  const expect = {
    contentType: "text/plain;charset=US-ASCII",
    base64Flag: false,
    data: "Hello%2C%20World!",
  };
  assert({ actual, expect });
}

{
  const actual = DATA_URL.parse(
    "data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D",
  );
  const expect = {
    contentType: "text/plain",
    base64Flag: true,
    data: "SGVsbG8sIFdvcmxkIQ%3D%3D",
  };
  assert({ actual, expect });
}

{
  const actual = DATA_URL.parse(
    "data:text/html,%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E",
  );
  const expect = {
    contentType: "text/html",
    base64Flag: false,
    data: "%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E",
  };
  assert({ actual, expect });
}

{
  const actual = DATA_URL.parse("data:text/html,<script>alert('hi');</script>");
  const expect = {
    contentType: "text/html",
    base64Flag: false,
    data: "<script>alert('hi');</script>",
  };
  assert({ actual, expect });
}
