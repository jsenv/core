import { assert } from "@jsenv/assert";

import { resolveDirectoryUrl } from "@jsenv/urls";

{
  const actual = resolveDirectoryUrl("dir", "file:///directory/");
  const expect = "file:///directory/dir/";
  assert({ actual, expect });
}
