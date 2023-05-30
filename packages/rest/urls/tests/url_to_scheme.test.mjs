import { assert } from "@jsenv/assert";

import { urlToScheme } from "@jsenv/urls";

{
  const actual = urlToScheme("http://example.com/dir/file.js");
  const expected = "http";
  assert({ actual, expected });
}

{
  const actual = urlToScheme("https://example.com/dir/file.js");
  const expected = "https";
  assert({ actual, expected });
}

{
  const actual = urlToScheme("file:///example.com/dir/file.js");
  const expected = "file";
  assert({ actual, expected });
}

{
  const actual = urlToScheme("about:blank");
  const expected = "about";
  assert({ actual, expected });
}
