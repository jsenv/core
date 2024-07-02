import { assert } from "@jsenv/assert";

import { moveUrl } from "@jsenv/urls";

{
  const actual = moveUrl({
    url: "http://localhost:3452/file.js",
    from: "http://localhost_alias:3452/",
    to: "file:///dir/",
  });
  const expect = "http://localhost:3452/file.js";
  assert({ actual, expect });
}
