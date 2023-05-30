import { assert } from "@jsenv/assert";

import { ensurePathnameTrailingSlash } from "@jsenv/urls";

{
  const actual = ensurePathnameTrailingSlash("file:///directory/file.js");
  const expected = "file:///directory/file.js/";
  assert({ actual, expected });
}

{
  const actual = ensurePathnameTrailingSlash("file:///directory");
  const expected = "file:///directory/";
  assert({ actual, expected });
}

{
  const actual = ensurePathnameTrailingSlash("file:///directory/");
  const expected = "file:///directory/";
  assert({ actual, expected });
}
