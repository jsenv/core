import { assert } from "@jsenv/assert";

import { ensurePathnameTrailingSlash } from "@jsenv/urls";

{
  const actual = ensurePathnameTrailingSlash("file:///directory/file.js");
  const expect = "file:///directory/file.js/";
  assert({ actual, expect });
}

{
  const actual = ensurePathnameTrailingSlash("file:///directory");
  const expect = "file:///directory/";
  assert({ actual, expect });
}

{
  const actual = ensurePathnameTrailingSlash("file:///directory/");
  const expect = "file:///directory/";
  assert({ actual, expect });
}
