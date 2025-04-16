import { assert } from "@jsenv/assert";

import { urlToOrigin } from "@jsenv/urls";

{
  const actual = urlToOrigin("http://example.com/dir/file.js?page=1");
  const expect = "http://example.com";
  assert({ actual, expect });
}

{
  const actual = urlToOrigin("file:///dir/file");
  const expect = "file://";
  assert({ actual, expect });
}

{
  const actual = urlToOrigin("file://C:\\dir\\file");
  const expect = "file://";
  assert({ actual, expect });
}
