import { assert } from "@jsenv/assert";

import { urlToScheme } from "@jsenv/urls";

{
  const actual = urlToScheme("http://example.com/dir/file.js");
  const expect = "http";
  assert({ actual, expect });
}

{
  const actual = urlToScheme("https://example.com/dir/file.js");
  const expect = "https";
  assert({ actual, expect });
}

{
  const actual = urlToScheme("file:///example.com/dir/file.js");
  const expect = "file";
  assert({ actual, expect });
}

{
  const actual = urlToScheme("about:blank");
  const expect = "about";
  assert({ actual, expect });
}
